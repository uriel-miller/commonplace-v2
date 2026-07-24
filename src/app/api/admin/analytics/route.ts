// /api/admin/analytics — product-analytics aggregates for the admin dashboard:
// totals, top screens, most-viewed listings (clicks per listing), the seller
// funnel (drop-off), top click targets, and a recent event feed.
//
// HARD RULES: admin-guarded (401 otherwise); prisma null-checked; every query
// wrapped so a single failure degrades to zeros. Response shape is always
// complete + typed so the dashboard renders even in a no-DB scenario.

import type { NextRequest } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const SELL_STEPS = ["opened", "named", "category", "priced", "photos", "submit", "completed"] as const;

export interface AnalyticsSummary {
  windowHours: number;
  totals: { events: number; users: number; sessions: number };
  topScreens: { screen: string; views: number }[];
  topListings: { listingId: number; views: number }[];
  topClicks: { name: string; count: number }[];
  sellFunnel: { step: string; users: number }[];
  recent: { name: string; screen: string | null; path: string | null; anonId: string; ts: string }[];
}

const empty = (windowHours: number): AnalyticsSummary => ({
  windowHours, totals: { events: 0, users: 0, sessions: 0 },
  topScreens: [], topListings: [], topClicks: [], sellFunnel: SELL_STEPS.map((s) => ({ step: s, users: 0 })), recent: [],
});

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const windowHours = Math.min(24 * 90, Math.max(1, Number(req.nextUrl.searchParams.get("hours") || "168")));
  if (!prisma) return Response.json(empty(windowHours));
  const since = new Date(Date.now() - windowHours * 3600_000);
  const p = prisma;

  const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    try { return await fn(); } catch (err) { console.warn("[api/admin/analytics] query failed", err); return fallback; }
  };
  const distinctCount = (where: object) =>
    safe(async () => (await p.analyticsEvent.findMany({ where, distinct: ["anonId"], select: { anonId: true } })).length, 0);

  try {
    const base = { ts: { gte: since } };
    const [events, users, sessions, screens, listings, clicks, recent, funnelCounts] = await Promise.all([
      safe(() => p.analyticsEvent.count({ where: base }), 0),
      distinctCount(base),
      safe(async () => (await p.analyticsEvent.findMany({ where: base, distinct: ["sessionId"], select: { sessionId: true } })).length, 0),
      safe(() => p.analyticsEvent.groupBy({ by: ["screen"], where: { ...base, type: "view", screen: { not: null } }, _count: { _all: true }, orderBy: { _count: { screen: "desc" } }, take: 12 }), [] as { screen: string | null; _count: { _all: number } }[]),
      safe(() => p.analyticsEvent.groupBy({ by: ["listingId"], where: { ...base, name: "listing:view", listingId: { not: null } }, _count: { _all: true }, orderBy: { _count: { listingId: "desc" } }, take: 20 }), [] as { listingId: number | null; _count: { _all: number } }[]),
      safe(() => p.analyticsEvent.groupBy({ by: ["name"], where: { ...base, type: "click" }, _count: { _all: true }, orderBy: { _count: { name: "desc" } }, take: 15 }), [] as { name: string; _count: { _all: number } }[]),
      safe(() => p.analyticsEvent.findMany({ where: base, orderBy: { ts: "desc" }, take: 40, select: { name: true, screen: true, path: true, anonId: true, ts: true } }), [] as { name: string; screen: string | null; path: string | null; anonId: string; ts: Date }[]),
      Promise.all(SELL_STEPS.map((step) => distinctCount({ ...base, name: `sell:${step}` }))),
    ]);

    return Response.json({
      windowHours,
      totals: { events, users, sessions },
      topScreens: screens.map((s) => ({ screen: s.screen ?? "unknown", views: s._count._all })),
      topListings: listings.map((l) => ({ listingId: l.listingId ?? 0, views: l._count._all })),
      topClicks: clicks.map((c) => ({ name: c.name, count: c._count._all })),
      sellFunnel: SELL_STEPS.map((step, i) => ({ step, users: funnelCounts[i] ?? 0 })),
      recent: recent.map((r) => ({ name: r.name, screen: r.screen, path: r.path, anonId: r.anonId.slice(0, 8), ts: r.ts.toISOString() })),
    } satisfies AnalyticsSummary);
  } catch (err) {
    console.warn("[api/admin/analytics] failed", err);
    return Response.json(empty(windowHours));
  }
}
