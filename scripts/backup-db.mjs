// Contingency snapshot: export the Listing / Offer / Order tables to a single
// timestamped JSON file via the generated Prisma client. Designed to run daily as
// a Railway cron so we always have a recent point-in-time copy of our commerce
// data even if the primary database is lost or corrupted.
//
// Run:  DATABASE_URL="prisma+postgres://…" node scripts/backup-db.mjs
//       DATABASE_URL="…" BACKUP_DIR=/data/backups node scripts/backup-db.mjs
//
// Node 24 loads the generated TypeScript Prisma client directly via native
// type-stripping — no build step required (same as scripts/import-listings.mjs).
// See scripts/README-backups.md for scheduling.

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

// Tables to snapshot. Each entry: the JSON key and the Prisma model accessor.
// Models added by later phases can be appended here without touching the flow.
const TABLES = [
  { key: "listings", model: "listing" },
  { key: "offers", model: "offer" },
  { key: "orders", model: "order" },
];

function timestamp() {
  // 2026-07-23T14-05-09-123Z → filesystem-safe ISO.
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error(
      "DATABASE_URL is not set. Point it at your Prisma Postgres connection string\n" +
        '(e.g. DATABASE_URL="prisma+postgres://…") and re-run. See scripts/README-backups.md.',
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

  const { PrismaPg } = await import("@prisma/adapter-pg");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

  const backupDir = resolve(process.env.BACKUP_DIR ?? "backups");
  const outFile = resolve(backupDir, `commonplace-backup-${timestamp()}.json`);

  const snapshot = {
    meta: {
      createdAt: new Date().toISOString(),
      generator: "scripts/backup-db.mjs",
      tables: TABLES.map((t) => t.key),
      counts: /** @type {Record<string, number>} */ ({}),
    },
    data: /** @type {Record<string, unknown[]>} */ ({}),
  };

  let totalRows = 0;
  let hadError = false;

  console.log("Starting Postgres → JSON backup…");

  try {
    await mkdir(backupDir, { recursive: true });

    for (const { key, model } of TABLES) {
      // A table a given schema doesn't have yet (e.g. Offer/Order pre-migration)
      // should not abort the whole backup — record it as empty and continue.
      const delegate = prisma[model];
      if (!delegate || typeof delegate.findMany !== "function") {
        console.warn(`  ${key}: model "${model}" not present in this schema — skipping.`);
        snapshot.data[key] = [];
        snapshot.meta.counts[key] = 0;
        continue;
      }
      try {
        const rows = await delegate.findMany();
        snapshot.data[key] = rows;
        snapshot.meta.counts[key] = rows.length;
        totalRows += rows.length;
        console.log(`  ${key}: ${rows.length} rows`);
      } catch (err) {
        hadError = true;
        snapshot.data[key] = [];
        snapshot.meta.counts[key] = 0;
        console.error(`  ${key}: export failed —`, err);
      }
    }

    // Prisma returns Date objects and BigInt for some columns; JSON.stringify
    // handles Dates (ISO) but not BigInt, so coerce BigInt → string safely.
    const json = JSON.stringify(
      snapshot,
      (_k, v) => (typeof v === "bigint" ? v.toString() : v),
      2,
    );
    await writeFile(outFile, json, "utf8");

    console.log(
      `Done. Wrote ${totalRows} rows across ${TABLES.length} tables to\n  ${outFile}`,
    );
    if (hadError) {
      console.error("One or more tables failed to export — see log above.");
      process.exitCode = 1;
    }
  } catch (err) {
    console.error("Backup failed:", err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
