# Importing listings into Postgres

The app reads from Postgres when a database is configured **and** the `Listing`
table has rows; otherwise it transparently falls back to the live WooCommerce
Store API (`src/lib/dataSource.ts`). This script fills the database.

## 1. Provision a database

This project targets **Prisma Postgres**, which needs no separate driver adapter.
Create one and copy its connection string (`prisma+postgres://…`):

```bash
npx create-db
# or create a Prisma Postgres database at https://console.prisma.io
```

Set it in the environment (both the CLI and the runtime read `DATABASE_URL`):

```bash
export DATABASE_URL="prisma+postgres://accelerate.prisma-data.net/?api_key=…"
```

> Prisma 7 no longer accepts `url` inside `datasource` in `schema.prisma`. The
> connection string lives in `prisma.config.ts` (`datasource.url` ← `DATABASE_URL`)
> for Migrate, and is passed to `new PrismaClient({ accelerateUrl })` at runtime.

## 2. Generate the client and create the schema

```bash
npx prisma generate                       # emits src/generated/prisma
npx prisma migrate deploy                 # apply committed migrations…
# …or, for a fresh/dev database with no migration history:
npx prisma db push
```

## 3. Import inventory

```bash
node scripts/import-listings.mjs
```

The script pages through the WooCommerce Store API (100/page), normalizes each
product identically to `src/lib/wc.ts`, skips junk/utility SKUs (add-ons,
warranties, check-ins, deposits, and anything under $10), and **upserts by product
id** so it is safe to re-run any time inventory changes. It also refreshes the
`Category` lookup table with per-category counts. Progress is logged per page.

## Notes

- **Idempotent:** re-running updates existing rows in place (upsert by `id`).
- **Node 24+** loads the generated TypeScript Prisma client via native
  type-stripping — no build step or loader flag required.
- To point at a plain `postgresql://` database instead of Prisma Postgres you must
  add a driver adapter (e.g. `@prisma/adapter-pg`) and pass `adapter` instead of
  `accelerateUrl` in `src/lib/db.ts`; the Accelerate path is the default here.
