// /api/admin/stats — admin dashboard aggregates (listings, categories, offers,
// orders, GMV, recent orders) computed from Prisma.
//
// HARD RULES: guarded by isAdmin() (401 otherwise); prisma null-checked; every
// DB call wrapped so a single failure degrades to zeros instead of throwing to
// the client. The response shape is always complete and typed — the dashboard
// can render immediately even in a total-outage / no-DB scenario.

import type { NextRequest } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import { safeJson } from "@/lib/resilience";

// Per-request DB state; never cache.
export const dynamic = "force-dynamic";

export interface AdminRecentOrder {
  id: string;
  listingTitle: string;
  buyerName: string;
  priceCents: number;
  status: string;
  createdAt: string; // ISO
}

export interface AdminStats {
  listings: number;
  categories: number;
  offers: {
    total: number;
    pending: number;
    accepted: number;
  };
  orders: {
    total: number;
    gmvCents: number;
    byStatus: Record<string, number>;
  };
  recentOrders: AdminRecentOrder[];
}

function emptyStats(): AdminStats {
  return {
    listings: 0,
    categories: 0,
    offers: { total: 0, pending: 0, accepted: 0 },
    orders: { total: 0, gmvCents: 0, byStatus: {} },
    recentOrders: [],
  };
}

async function computeStats(): Promise<AdminStats> {
  const db = prisma;
  // No DB configured → return zeros (fail-soft, still a valid shape).
  if (!db) return emptyStats();

  // Each aggregate is independently guarded so one failing query can't zero out
  // the others; the whole batch runs concurrently.
  const [listings, categories, offerGroups, orderCount, orderAgg, orderGroups, recent] =
    await Promise.all([
      safeJson(() => db.listing.count(), 0, "stats.listings"),
      safeJson(() => db.category.count(), 0, "stats.categories"),
      safeJson(
        () => db.offer.groupBy({ by: ["status"], _count: { _all: true } }),
        [] as Array<{ status: string; _count: { _all: number } }>,
        "stats.offerGroups",
      ),
      safeJson(() => db.order.count(), 0, "stats.orderCount"),
      safeJson(
        () => db.order.aggregate({ _sum: { priceCents: true } }),
        { _sum: { priceCents: null } } as { _sum: { priceCents: number | null } },
        "stats.orderAgg",
      ),
      safeJson(
        () => db.order.groupBy({ by: ["status"], _count: { _all: true } }),
        [] as Array<{ status: string; _count: { _all: number } }>,
        "stats.orderGroups",
      ),
      safeJson(
        () =>
          db.order.findMany({
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
              id: true,
              listingTitle: true,
              buyerName: true,
              priceCents: true,
              status: true,
              createdAt: true,
            },
          }),
        [] as Array<{
          id: string;
          listingTitle: string;
          buyerName: string;
          priceCents: number;
          status: string;
          createdAt: Date;
        }>,
        "stats.recentOrders",
      ),
    ]);

  let offerTotal = 0;
  let offerPending = 0;
  let offerAccepted = 0;
  for (const g of offerGroups) {
    const n = g._count._all;
    offerTotal += n;
    if (g.status === "pending") offerPending += n;
    else if (g.status === "accepted") offerAccepted += n;
  }

  const byStatus: Record<string, number> = {};
  for (const g of orderGroups) {
    byStatus[g.status] = g._count._all;
  }

  return {
    listings,
    categories,
    offers: { total: offerTotal, pending: offerPending, accepted: offerAccepted },
    orders: {
      total: orderCount,
      gmvCents: orderAgg._sum.priceCents ?? 0,
      byStatus,
    },
    recentOrders: recent.map((o) => ({
      id: o.id,
      listingTitle: o.listingTitle,
      buyerName: o.buyerName,
      priceCents: o.priceCents,
      status: o.status,
      createdAt: o.createdAt.toISOString(),
    })),
  };
}

export async function GET(req: NextRequest): Promise<Response> {
  // Admin guard — false-safe; anything but a valid admin → 401.
  try {
    if (!(await isAdmin(req))) {
      return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  } catch (err) {
    console.warn("[api/admin/stats] auth check failed", err);
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const stats = await computeStats();
    return Response.json(stats, { status: 200 });
  } catch (err) {
    // Belt-and-suspenders: computeStats already fail-softs internally.
    console.warn("[api/admin/stats][GET] failed", err);
    return Response.json(emptyStats(), { status: 200 });
  }
}
