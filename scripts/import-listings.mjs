// Import live WooCommerce inventory into Postgres via Prisma.
//
// Pages through the WooCommerce Store API, normalizes each product EXACTLY the way
// src/lib/wc.ts does (decodeEntities / stripTags / parseLocation / parseCondition
// and the junk-SKU filter), then upserts into the `Listing` table keyed by product
// id — so re-running is idempotent. Distinct categories are collected into the
// `Category` lookup table with counts.
//
// Run:  DATABASE_URL="prisma+postgres://…" node scripts/import-listings.mjs
// (Requires `prisma generate` + a migrated database first — see README-import.md.)
//
// Node 24 loads the generated TypeScript client directly via native type-stripping.

const WC_BASE = "https://trycommonplace.com/wp-json/wc/store/v1";
const PER_PAGE = 100;

/* ----------------------- normalization (mirrors wc.ts) ---------------------- */

const NAMED = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  hellip: "…", mdash: "—", ndash: "–", rsquo: "’", lsquo: "‘",
  ldquo: "“", rdquo: "”", deg: "°", frac12: "½", frac14: "¼", frac34: "¾",
};

function safeCodePoint(cp) {
  try {
    return String.fromCodePoint(cp);
  } catch {
    return "";
  }
}

function decodeEntities(input) {
  if (!input) return "";
  let s = input;
  // Decode twice to handle double-encoding (&amp;#8211;).
  for (let i = 0; i < 2; i++) {
    s = s
      .replace(/&#x([0-9a-f]+);/gi, (_m, h) => safeCodePoint(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_m, n) => safeCodePoint(parseInt(n, 10)))
      .replace(/&([a-z0-9]+);/gi, (m, name) => NAMED[name.toLowerCase()] ?? m);
  }
  return s;
}

function stripTags(html) {
  const withBreaks = html
    .replace(/<\/(p|div|li)>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ");
  const text = decodeEntities(withBreaks.replace(/<[^>]+>/g, ""));
  return text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function parseLocation(title) {
  const m = title.match(/[–—-]\s*([A-Za-z][A-Za-z .'-]+,\s*[A-Z]{2})\s*$/);
  return m ? m[1].trim() : null;
}

const CONDITION_RX =
  /\b(brand new|open box|like new|refurbished|excellent|very good|good|fair|new|used)\b/i;

function parseCondition(title, tags) {
  const fromTag = tags.map((t) => t.toLowerCase()).find((t) => CONDITION_RX.test(t));
  const src = fromTag ?? title;
  const m = src.match(CONDITION_RX);
  if (!m) return null;
  const c = m[1].toLowerCase();
  return c.charAt(0).toUpperCase() + c.slice(1);
}

function normalize(p) {
  const title = decodeEntities(p.name);
  const priceCents = parseInt(p.prices?.price ?? "0", 10) || 0;
  const regular = parseInt(p.prices?.regular_price ?? "0", 10) || 0;
  const retailCents = p.on_sale && regular > priceCents ? regular : null;
  const savingsPct = retailCents ? Math.round((1 - priceCents / retailCents) * 100) : null;
  const dims =
    p.formatted_dimensions && p.formatted_dimensions !== "N/A" ? p.formatted_dimensions : null;
  const weight = p.formatted_weight && p.formatted_weight !== "N/A" ? p.formatted_weight : null;
  return {
    id: p.id,
    slug: p.slug,
    title,
    priceCents,
    retailCents,
    savingsPct,
    categoryName: p.categories?.[0]?.name ?? "Marketplace",
    categorySlug: p.categories?.[0]?.slug ?? "",
    location: parseLocation(title),
    condition: parseCondition(title, (p.tags ?? []).map((t) => t.name)),
    images: (p.images ?? []).map((i) => i.src).filter(Boolean),
    description: stripTags(p.description || p.short_description || ""),
    sku: p.sku ?? "",
    dimensions: dims,
    weight,
    rating: parseFloat(p.average_rating || "0") || 0,
    reviewCount: p.review_count ?? 0,
    permalink: p.permalink,
  };
}

// Utility/service SKUs that live in the catalog but aren't sellable listings.
const JUNK_RX =
  /\b(warranty|check[-\s]?in|pre[-\s]?pickup|deposit|reservation|add[-\s]?on|balance|remainder|test\s?drive|handling fee|shipping fee|placeholder|sample product)\b/i;

function isRealListing(l) {
  if (l.categorySlug === "addons" || l.categoryName.toLowerCase() === "addons") return false;
  if (JUNK_RX.test(l.title)) return false;
  if (l.priceCents < 1000) return false; // < $10 → not a real big-ticket item
  return true;
}

/* --------------------------------- fetch ----------------------------------- */

async function fetchPage(page) {
  const url = `${WC_BASE}/products?per_page=${PER_PAGE}&page=${page}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`WooCommerce ${res.status} for ${url}`);
  const totalPages = parseInt(res.headers.get("x-wp-totalpages") ?? "0", 10) || 0;
  const json = await res.json();
  return { products: Array.isArray(json) ? json : [], totalPages };
}

/* --------------------------------- main ------------------------------------ */

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error(
      "DATABASE_URL is not set. Point it at your Prisma Postgres connection string\n" +
        '(e.g. DATABASE_URL="prisma+postgres://…") and re-run. See scripts/README-import.md.',
    );
    process.exit(1);
  }

  // The generated client is emitted as TypeScript; Node loads it via type-stripping.
  const clientUrl = new URL("../src/generated/prisma/client.ts", import.meta.url);
  let PrismaClient;
  try {
    ({ PrismaClient } = await import(clientUrl.href));
  } catch (err) {
    console.error(
      "Could not load the generated Prisma client. Run `npx prisma generate` first.\n",
      err,
    );
    process.exit(1);
  }

  const prisma = new PrismaClient({ accelerateUrl: databaseUrl });

  let page = 1;
  let totalPages = 1;
  let scanned = 0;
  let upserted = 0;
  let skipped = 0;
  const categories = new Map(); // slug -> { name, count }

  console.log("Starting WooCommerce → Postgres import…");

  try {
    do {
      const { products, totalPages: tp } = await fetchPage(page);
      if (tp) totalPages = tp;
      if (products.length === 0) break;

      for (const raw of products) {
        scanned++;
        const listing = normalize(raw);
        if (!isRealListing(listing)) {
          skipped++;
          continue;
        }

        await prisma.listing.upsert({
          where: { id: listing.id },
          create: listing,
          update: listing,
        });
        upserted++;

        if (listing.categorySlug) {
          const existing = categories.get(listing.categorySlug);
          if (existing) existing.count++;
          else categories.set(listing.categorySlug, { name: listing.categoryName, count: 1 });
        }
      }

      console.log(
        `  page ${page}/${totalPages} — scanned ${scanned}, upserted ${upserted}, skipped ${skipped}`,
      );
      page++;
    } while (page <= totalPages);

    // Refresh the category lookup table with current counts.
    for (const [slug, { name, count }] of categories) {
      await prisma.category.upsert({
        where: { slug },
        create: { slug, name, count },
        update: { name, count },
      });
    }

    console.log(
      `Done. Upserted ${upserted} listings and ${categories.size} categories ` +
        `(skipped ${skipped} junk/utility SKUs across ${scanned} products).`,
    );
  } catch (err) {
    console.error("Import failed:", err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
