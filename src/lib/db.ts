// Prisma client singleton — safe across Next.js dev hot-reloads.
//
// Prisma 7 requires either a driver adapter or an Accelerate connection to reach
// the database. This project targets Prisma Postgres (see `npx create-db`), whose
// `prisma+postgres://…` connection string is passed as `accelerateUrl` — no extra
// adapter package required. Set it via the DATABASE_URL env var.
//
// When DATABASE_URL is unset we export `null`, and src/lib/dataSource.ts transparently
// falls back to the live WooCommerce source. This module is server-only.

import { PrismaClient } from "@/generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;

function createClient(): PrismaClient | null {
  if (!databaseUrl) return null;
  try {
    return new PrismaClient({ accelerateUrl: databaseUrl });
  } catch (err) {
    console.warn("[db] Prisma client init failed; data layer will use fallback source.", err);
    return null;
  }
}

// Reuse the client across hot reloads in dev to avoid exhausting connections.
const globalForPrisma = globalThis as unknown as { __cpPrisma?: PrismaClient | null };

export const prisma: PrismaClient | null =
  globalForPrisma.__cpPrisma !== undefined
    ? globalForPrisma.__cpPrisma
    : (globalForPrisma.__cpPrisma = createClient());

/** True when a DATABASE_URL is configured (a Prisma client was constructed). */
export function hasDatabaseUrl(): boolean {
  return prisma !== null;
}
