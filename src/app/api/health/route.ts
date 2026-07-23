// Liveness / readiness probe. GET /api/health reports whether the database is
// reachable and which source is serving inventory, plus a live listing count.
// This route NEVER throws — every failure mode degrades into a reported status so
// uptime monitors (Railway healthcheck, external pingers) get a 200 with a body
// they can inspect rather than a 500.

import { prisma } from "@/lib/db";
import { withTimeout, safeJson } from "@/lib/resilience";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DbStatus = "up" | "down" | "fallback";
type Source = "postgres" | "woocommerce";

export interface HealthPayload {
  ok: boolean;
  db: DbStatus;
  source: Source;
  listingCount: number;
  /** Millis spent probing the DB — useful for latency alerting. */
  probeMs: number;
  ts: string;
}

// Bound the DB probe so a hung connection can't stall the health check.
const PROBE_TIMEOUT_MS = 3000;

export async function GET(): Promise<Response> {
  const started = Date.now();

  const payload = await safeJson<HealthPayload>(
    async () => {
      // No DATABASE_URL configured → the app runs entirely on WooCommerce fallback.
      if (!prisma) {
        return {
          ok: true,
          db: "fallback",
          source: "woocommerce",
          listingCount: 0,
          probeMs: Date.now() - started,
          ts: new Date().toISOString(),
        };
      }

      const client = prisma;
      // A cheap count doubles as a connectivity probe.
      const listingCount = await withTimeout(client.listing.count(), PROBE_TIMEOUT_MS, "db.count");
      // DB reachable but empty → data layer still serves from WooCommerce.
      const source: Source = listingCount > 0 ? "postgres" : "woocommerce";
      return {
        ok: true,
        db: "up",
        source,
        listingCount,
        probeMs: Date.now() - started,
        ts: new Date().toISOString(),
      };
    },
    // Fallback: prisma is configured but the probe failed/timed out → db is down,
    // but the app itself keeps serving via WooCommerce, so ok stays true.
    () => ({
      ok: true,
      db: "down" as const,
      source: "woocommerce" as const,
      listingCount: 0,
      probeMs: Date.now() - started,
      ts: new Date().toISOString(),
    }),
    "health probe",
  );

  return Response.json(payload, { status: 200 });
}
