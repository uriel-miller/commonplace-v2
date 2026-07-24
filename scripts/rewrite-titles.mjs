// Rewrite listing titles into the fuller, SEO-friendly "AI" style:
//   "<existing title, proper-cased> – <Condition> – <City, ST>"
// Idempotent + fail-soft: only appends condition/location when they aren't
// already present, so re-running never double-stamps. Titles that already have
// both are left untouched.
//
// Run:  DATABASE_URL="postgresql://…" node scripts/rewrite-titles.mjs

const SMALL = new Set(["a", "an", "and", "the", "of", "in", "on", "for", "with", "to", "by", "or", "at"]);
function properCase(s) {
  return String(s || "")
    .replace(/\s+/g, " ").trim()
    .split(" ")
    .map((w, i) => {
      if (!w) return w;
      if (/[A-Z]/.test(w)) return w;            // brand/acronym
      if (/^[0-9]/.test(w)) return w;            // year / model code
      if (i > 0 && SMALL.has(w.toLowerCase())) return w.toLowerCase();
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ")
    .trim();
}
function conditionPhrase(cond) {
  const c = String(cond || "").trim();
  if (!c) return "";
  if (/^(new|like ?new)$/i.test(c)) return c.replace(/\b\w/g, (m) => m.toUpperCase());
  return `${c.replace(/\b\w/g, (m) => m.toUpperCase())} Condition`;
}
function cityState(loc) {
  const m = String(loc || "").match(/([A-Za-z][A-Za-z .'-]*),\s*([A-Za-z]{2})\b/);
  return m ? `${m[1].trim()}, ${m[2].toUpperCase()}` : "";
}

function buildTitle(title, condition, location) {
  let s = properCase(title);
  const lower = s.toLowerCase();
  // Append condition when the title doesn't already state it.
  const cp = conditionPhrase(condition);
  if (cp && !new RegExp(`\\b${cp.split(" ")[0]}\\b`, "i").test(s) && !/condition|like new|\bnew\b|good|excellent|fair/i.test(lower)) {
    s = `${s} – ${cp}`;
  }
  // Append City, ST when missing.
  const cs = cityState(location);
  if (cs && !/,\s*[A-Z]{2}\b/.test(s)) s = `${s} – ${cs}`;
  return s;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) { console.error('DATABASE_URL not set.'); process.exit(1); }
  const clientUrl = new URL("../src/generated/prisma/client.ts", import.meta.url);
  const { PrismaClient } = await import(clientUrl.href);
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

  let updated = 0, scanned = 0, unchanged = 0;
  const BATCH = 500;
  try {
    let cursor = 0;
    for (;;) {
      const rows = await prisma.listing.findMany({
        where: { id: { gt: cursor } },
        orderBy: { id: "asc" },
        take: BATCH,
        select: { id: true, title: true, condition: true, location: true },
      });
      if (rows.length === 0) break;
      cursor = rows[rows.length - 1].id;
      for (const r of rows) {
        scanned += 1;
        try {
          const next = buildTitle(r.title, r.condition, r.location);
          if (next && next !== r.title) {
            await prisma.listing.update({ where: { id: r.id }, data: { title: next } });
            updated += 1;
          } else unchanged += 1;
        } catch (err) {
          console.warn(`  listing ${r.id} failed:`, err.message);
        }
      }
      console.log(`  scanned ${scanned}, updated ${updated}…`);
    }
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
  console.log(`\nDone. Scanned ${scanned}, updated ${updated}, unchanged ${unchanged}.`);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
