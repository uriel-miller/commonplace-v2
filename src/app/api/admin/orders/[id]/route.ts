// /api/admin/orders/[id] — PATCH: advance an order through its delivery lifecycle,
// writing an append-only OrderEvent. Admin-guarded. Fail-soft: bad input → typed
// 4xx; any other failure → typed body + 200 (never throw to the client).
//
// Lifecycle (linear):
//   reserved → scheduled → picked_up → in_transit → delivered → paid
// Plus: any non-terminal status may transition to `cancelled`.
// `paid` and `cancelled` are terminal.

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export type OrderStatus =
  | "reserved"
  | "scheduled"
  | "picked_up"
  | "in_transit"
  | "delivered"
  | "paid"
  | "cancelled";

const ALL_STATUSES: readonly OrderStatus[] = [
  "reserved",
  "scheduled",
  "picked_up",
  "in_transit",
  "delivered",
  "paid",
  "cancelled",
];

// Linear "next" step for each status (null = terminal / no forward step).
const NEXT: Record<OrderStatus, OrderStatus | null> = {
  reserved: "scheduled",
  scheduled: "picked_up",
  picked_up: "in_transit",
  in_transit: "delivered",
  delivered: "paid",
  paid: null,
  cancelled: null,
};

const TERMINAL: ReadonlySet<OrderStatus> = new Set<OrderStatus>(["paid", "cancelled"]);

/** Human-readable event labels for the timeline. */
const EVENT_LABEL: Record<OrderStatus, string> = {
  reserved: "Order reserved",
  scheduled: "Delivery scheduled",
  picked_up: "Picked up from seller",
  in_transit: "In transit to buyer",
  delivered: "Delivered to buyer",
  paid: "Payment settled",
  cancelled: "Order cancelled",
};

function isOrderStatus(s: unknown): s is OrderStatus {
  return typeof s === "string" && (ALL_STATUSES as readonly string[]).includes(s);
}

/** Whether `to` is a permitted transition from `from`. */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return false;
  if (TERMINAL.has(from)) return false; // terminal states are frozen
  if (to === "cancelled") return true; // any live order may be cancelled
  return NEXT[from] === to; // otherwise only the single linear next step
}

interface PatchResponse {
  ok: boolean;
  error?: string;
  status?: OrderStatus;
}

function fail(error: string, status: number): Response {
  return Response.json({ ok: false, error } satisfies PatchResponse, { status });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  // Guard first.
  let admin = false;
  try {
    admin = await isAdmin(req);
  } catch {
    admin = false;
  }
  if (!admin) return fail("unauthorized", 401);

  let id = "";
  try {
    id = (await ctx.params).id;
  } catch {
    /* fall through */
  }
  if (!id) return fail("missing-id", 400);

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return fail("invalid-json", 400);
  }

  const next = (body as Record<string, unknown> | null)?.status;
  if (!isOrderStatus(next)) return fail("invalid-status", 400);

  try {
    if (!prisma) return fail("db-unavailable", 200);

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return fail("not-found", 404);

    const from = isOrderStatus(order.status) ? order.status : "reserved";
    if (!canTransition(from, next)) {
      return Response.json(
        { ok: false, error: "illegal-transition", status: from } satisfies PatchResponse,
        { status: 409 },
      );
    }

    // Advance the order and append the timeline event atomically.
    await prisma.$transaction([
      prisma.order.update({ where: { id }, data: { status: next } }),
      prisma.orderEvent.create({ data: { orderId: id, label: EVENT_LABEL[next] } }),
    ]);

    return Response.json({ ok: true, status: next } satisfies PatchResponse, { status: 200 });
  } catch (err) {
    console.warn("[api/admin/orders/[id]][PATCH] failed", err);
    return fail("server-error", 200);
  }
}
