// Import the live WordPress blog/articles into Postgres via Prisma.
//
// Pages through the public WP REST API (/wp-json/wp/v2/posts), decodes entities,
// strips <script>/<style>, builds a plain-text excerpt, resolves the featured
// image + category names, then upserts into the `BlogPost` table keyed by post id
// — so re-running is idempotent. Every network + per-post step is fail-soft.
//
// Run:  DATABASE_URL="postgresql://…" node scripts/import-blog.mjs
// (Requires `npx prisma generate` + a migrated database first.)

const WP_BASE = "https://trycommonplace.com/wp-json/wp/v2";
const PER_PAGE = 100;
const MAX_RETRIES = 3;

/* ------------------------------- normalization ------------------------------ */

const NAMED = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  hellip: "…", mdash: "—", ndash: "–", rsquo: "’", lsquo: "‘",
  ldquo: "“", rdquo: "”", deg: "°", frac12: "½", frac14: "¼", frac34: "¾",
};
function safeCodePoint(cp) { try { return String.fromCodePoint(cp); } catch { return ""; } }
function decodeEntities(input) {
  if (!input) return "";
  let s = String(input);
  for (let i = 0; i < 2; i++) {
    s = s
      .replace(/&#x([0-9a-f]+);/gi, (_m, h) => safeCodePoint(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_m, n) => safeCodePoint(parseInt(n, 10)))
      .replace(/&([a-z0-9]+);/gi, (m, name) => NAMED[name.toLowerCase()] ?? m);
  }
  return s;
}
function stripTags(html) {
  return decodeEntities(String(html || "").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}
/** Remove executable/style tags but keep the article HTML. */
function sanitizeHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "") // strip inline event handlers
    .replace(/\son\w+='[^']*'/gi, "");
}

/* --------------------------------- fetching --------------------------------- */

async function fetchJson(url) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const totalPages = Number(res.headers.get("x-wp-totalpages") || "0");
      const data = await res.json();
      return { data, totalPages };
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
  throw lastErr;
}

function pickCover(post) {
  try {
    const media = post?._embedded?.["wp:featuredmedia"]?.[0];
    return media?.source_url || media?.media_details?.sizes?.large?.source_url || null;
  } catch { return null; }
}
function pickCategories(post) {
  try {
    const terms = (post?._embedded?.["wp:term"] || []).flat();
    const names = terms.filter((t) => t?.taxonomy === "category").map((t) => decodeEntities(t.name));
    return names.length ? names.join(", ") : null;
  } catch { return null; }
}

/* ---------------------------------- main ------------------------------------ */

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set. e.g. DATABASE_URL="postgresql://…" node scripts/import-blog.mjs');
    process.exit(1);
  }
  const clientUrl = new URL("../src/generated/prisma/client.ts", import.meta.url);
  let PrismaClient;
  try { ({ PrismaClient } = await import(clientUrl.href)); }
  catch (err) { console.error("Run `npx prisma generate` first.\n", err); process.exit(1); }
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

  let page = 1, totalPages = 1, scanned = 0, upserted = 0, skipped = 0;
  console.log("Starting WordPress → Postgres blog import…");

  try {
    do {
      const url = `${WP_BASE}/posts?per_page=${PER_PAGE}&page=${page}&_embed=wp:featuredmedia,wp:term&_fields=id,slug,title,excerpt,content,date_gmt,_links,_embedded`;
      let batch;
      try {
        const r = await fetchJson(url);
        batch = Array.isArray(r.data) ? r.data : [];
        if (page === 1) totalPages = Math.max(1, r.totalPages || 1);
      } catch (err) {
        console.warn(`  page ${page} failed after retries — skipping:`, err.message);
        page += 1;
        continue;
      }

      for (const post of batch) {
        scanned += 1;
        try {
          const id = Number(post.id);
          const slug = String(post.slug || "").trim();
          const title = decodeEntities(post?.title?.rendered || "").trim();
          if (!id || !slug || !title) { skipped += 1; continue; }
          const excerpt = stripTags(post?.excerpt?.rendered || "").slice(0, 400);
          const contentHtml = sanitizeHtml(post?.content?.rendered || "");
          const publishedAt = new Date(post.date_gmt ? `${post.date_gmt}Z` : Date.now());
          const data = {
            slug, title, excerpt, contentHtml,
            coverImage: pickCover(post),
            category: pickCategories(post),
            publishedAt: Number.isNaN(publishedAt.getTime()) ? new Date() : publishedAt,
          };
          await prisma.blogPost.upsert({ where: { id }, create: { id, ...data }, update: data });
          upserted += 1;
        } catch (err) {
          skipped += 1;
          console.warn(`  post ${post?.slug || post?.id} failed — skipping:`, err.message);
        }
      }
      console.log(`  page ${page}/${totalPages}: ${batch.length} posts (${upserted} upserted so far)`);
      page += 1;
    } while (page <= totalPages);
  } finally {
    await prisma.$disconnect().catch(() => {});
  }

  console.log(`\nDone. Scanned ${scanned}, upserted ${upserted}, skipped ${skipped}.`);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
