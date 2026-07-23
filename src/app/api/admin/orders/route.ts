// /api/admin/orders — GET: every order with its lifecycle events, newest first.
// Admin-guarded (isAdmin). Fail-soft: on any error returns an empty list + 200 so
// the admin table degrades gracefully instead of throwing to the client.

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import { safeJson } from "@/lib/resilience";

// Order state is per-request DB truth; never cache.
export const dynamic = "force-dynamic";

/** One lifecycle event (append-only timeline entry). */
export interface AdminOrderEvent {
  id: string;
  label: string;
  at: string;
}

/** Plain-JSON order row shipped to the admin UI. Money in integer cents. */
export interface AdminOrderDTO {
  id: string;
  listingId: number;
  listingTitle: string;
  listingImage: string | null;
  buyerName: string;
  priceCents: number;
  depositCents: number;
  balanceCents: number;
  deliveryFeeCents: number;
  status: string;
  pickupCity: string | null;
  deliverCity: string | null;
  createdAt: string;
  updatedAt: string;
  events: AdminOrderEvent[];
}

export interface AdminOrdersResponse {
  ok: boolean;
  orders: AdminOrderDTO[];
}

function unauthorized(): Response {
  return Response.json({ ok: false, orders: [] } satisfies AdminOrdersResponse, {
    status: 401,
  });
}

export async function GET(req: NextRequest): Promise<Response> {
  let ok = false;
  try {
    ok = await isAdmin(req);
  } catch {
    ok = false;
  }
  if (!ok) return unauthorized();

  const orders = await safeJson<AdminOrderDTO[]>(
    async () => {
      if (!prisma) return [];
      const rows = await prisma.order.findMany({ orderBy: { createdAt: "desc" } });
      if (rows.length === 0) return [];

      // Fetch all events for these orders in one query, then group by orderId.
      const ids = rows.map((r) => r.id);
      const events = await prisma.orderEvent.findMany({
        where: { orderId: { in: ids } },
        orderBy: { at: "asc" },
      });
      const byOrder = new Map<string, AdminOrderEvent[]>();
      for (const e of events) {
        const list = byOrder.get(e.orderId) ?? [];
        list.push({ id: e.id, label: e.label, at: e.at.toISOString() });
        byOrder.set(e.orderId, list);
      }

      return rows.map((r) => ({
        id: r.id,
        listingId: r.listingId,
        listingTitle: r.listingTitle,
        listingImage: r.listingImage ?? null,
        buyerName: r.buyerName,
        priceCents: r.priceCents,
        depositCents: r.depositCents,
        balanceCents: r.balanceCents,
        deliveryFeeCents: r.deliveryFeeCents,
        status: r.status,
        pickupCity: r.pickupCity ?? null,
        deliverCity: r.deliverCity ?? null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        events: byOrder.get(r.id) ?? [],
      }));
    },
    [],
    "api/admin/orders GET",
  );

  return Response.json({ ok: true, orders } satisfies AdminOrdersResponse, { status: 200 });
}
