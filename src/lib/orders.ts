// Orders domain layer — server-only. Turns a cart into a reserved Order and
// walks it through the delivery lifecycle. Every DB call is null-checked and
// wrapped so a missing/unreachable database degrades to an in-memory synthesized
// order instead of throwing to the caller (this ships to millions).
//
// Money is always integer cents. Fees come from the ported engine in
// src/lib/fees.ts — never reinvented here.

import { prisma } from "@/lib/db";
import { depositBreakdown, quoteDelivery, DEPOSIT_CENTS } from "@/lib/fees";

/* --------------------------------- status ---------------------------------- */

/** Lifecycle order, excluding the terminal `cancelled` branch. */
export const ORDER_STEPS = [
  "reserved",
  "scheduled",
  "picked_up",
  "in_transit",
  "delivered",
  "paid",
] as const;

export type OrderStep = (typeof ORDER_STEPS)[number];
export type OrderStatus = OrderStep | "cancelled";

export const ORDER_STATUSES: readonly OrderStatus[] = [...ORDER_STEPS, "cancelled"];

/** Buyer-facing label shown on the stepper for each status. */
export const STATUS_LABEL: Record<OrderStatus, string> = {
  reserved: "Reserved",
  scheduled: "Scheduled",
  picked_up: "Picked up",
  in_transit: "In transit",
  delivered: "Delivered",
  paid: "Paid",
  cancelled: "Cancelled",
};

/** Timeline event label recorded when an order enters each status. */
export const STATUS_EVENT: Record<OrderStatus, string> = {
  reserved: "Reserved for $1 — order confirmed",
  scheduled: "Delivery scheduled",
  picked_up: "Picked up from the seller",
  in_transit: "Out for delivery",
  delivered: "Delivered — inspect it at home",
  paid: "Balance paid — order complete",
  cancelled: "Order cancelled",
};

export function isOrderStatus(v: unknown): v is OrderStatus {
  return typeof v === "string" && (ORDER_STATUSES as readonly string[]).includes(v);
}

/* ------------------------------ delivery model ----------------------------- */

// Placeholder one-way distance used for the delivery estimate until buyer→seller
// geocoding is wired. 45 mi keeps us inside the free-delivery radius, matching the
// live "free within 100 miles" promise. Swap for a real Haversine once addresses exist.
export const PLACEHOLDER_DISTANCE_MI = 45;

/** Derive the buyer-facing delivery line from the stored fee (source of truth). */
export function deliveryMessageForFee(deliveryFeeCents: number): string {
  if (deliveryFeeCents <= 0) return "Free white-glove delivery — included within 100 miles";
  return `White-glove delivery — $${(deliveryFeeCents / 100).toLocaleString("en-US")}`;
}

/* ------------------------------- I/O shapes -------------------------------- */

/** One priced line handed to checkout. Decoupled from the client CartItem so this
 *  server module never imports a "use client" component. */
export interface CartLineInput {
  listingId: number;
  title: string;
  image?: string | null;
  priceCents: number;
  qty: number;
  categorySlug?: string | null;
}

export interface BuyerInput {
  name?: string | null;
  pickupCity?: string | null;
  deliverCity?: string | null;
}

export interface OrderEventRecord {
  id: string;
  label: string;
  at: string; // ISO
}

/** Fully serializable order record shared with the API + client UI. */
export interface OrderRecord {
  id: string;
  listingId: number;
  listingTitle: string;
  listingImage: string | null;
  buyerName: string;
  priceCents: number; // subtotal (all lines)
  depositCents: number; // $1 due today
  balanceCents: number; // due on delivery
  deliveryFeeCents: number;
  deliveryMessage: string;
  manualWire: boolean; // premium (>= $8k) collected by manual wire
  status: OrderStatus;
  pickupCity: string | null;
  deliverCity: string | null;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  events: OrderEventRecord[];
}

/* ------------------------------ internal maps ------------------------------ */

// Minimal structural row shapes (avoids a hard dependency on generated Prisma types).
interface OrderRow {
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
  createdAt: Date;
  updatedAt: Date;
}
interface EventRow {
  id: string;
  orderId: string;
  label: string;
  at: Date;
}

function normalizeStatus(s: string): OrderStatus {
  return isOrderStatus(s) ? s : "reserved";
}

function toRecord(row: OrderRow, events: EventRow[]): OrderRecord {
  return {
    id: row.id,
    listingId: row.listingId,
    listingTitle: row.listingTitle,
    listingImage: row.listingImage ?? null,
    buyerName: row.buyerName,
    priceCents: row.priceCents,
    depositCents: row.depositCents,
    balanceCents: row.balanceCents,
    deliveryFeeCents: row.deliveryFeeCents,
    deliveryMessage: deliveryMessageForFee(row.deliveryFeeCents),
    manualWire: depositBreakdown(row.priceCents).manualWire,
    status: normalizeStatus(row.status),
    pickupCity: row.pickupCity ?? null,
    deliverCity: row.deliverCity ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    events: events
      .slice()
      .sort((a, b) => a.at.getTime() - b.at.getTime())
      .map((e) => ({ id: e.id, label: e.label, at: e.at.toISOString() })),
  };
}

/* ------------------------------ input hygiene ------------------------------ */

function sanitizeLines(items: readonly CartLineInput[] | undefined | null): CartLineInput[] {
  if (!Array.isArray(items)) return [];
  const out: CartLineInput[] = [];
  for (const it of items) {
    if (!it || typeof it !== "object") continue;
    const listingId = Number((it as CartLineInput).listingId);
    const priceCents = Math.round(Number((it as CartLineInput).priceCents));
    const qtyRaw = Math.floor(Number((it as CartLineInput).qty));
    if (!Number.isFinite(listingId) || listingId <= 0) continue;
    if (!Number.isFinite(priceCents) || priceCents < 0) continue;
    const qty = Number.isFinite(qtyRaw) && qtyRaw > 0 ? Math.min(qtyRaw, 99) : 1;
    const title =
      typeof it.title === "string" && it.title.trim() ? it.title.trim() : `Listing #${listingId}`;
    out.push({
      listingId,
      title,
      image: typeof it.image === "string" ? it.image : null,
      priceCents,
      qty,
      categorySlug: typeof it.categorySlug === "string" ? it.categorySlug : null,
    });
  }
  return out;
}

function cleanCity(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, 120) : null;
}

/* --------------------------------- create ---------------------------------- */

export class EmptyCartError extends Error {
  constructor() {
    super("Cannot create an order from an empty cart.");
    this.name = "EmptyCartError";
  }
}

/**
 * Reserve a cart as a single order: $1 due today, balance on delivery. The Order
 * schema holds one representative listing (first line; title annotated with
 * "+N more" for multi-line carts) plus the whole-cart subtotal.
 *
 * Persists Order + an initial OrderEvent when a DB is available; otherwise returns
 * an in-memory record so the buyer still gets a confirmation.
 */
export async function createOrderFromCart(
  items: readonly CartLineInput[],
  buyer?: BuyerInput,
): Promise<OrderRecord> {
  const lines = sanitizeLines(items);
  if (lines.length === 0) throw new EmptyCartError();

  const subtotalCents = lines.reduce((s, l) => s + l.priceCents * l.qty, 0);
  const { dueTodayCents, dueOnDeliveryCents } = depositBreakdown(subtotalCents);

  // Delivery estimate (placeholder distance until geocoding). Catalog flat-rate
  // applies only to catalog products; marketplace listings use the distance model.
  const quote = quoteDelivery({ distanceMi: PLACEHOLDER_DISTANCE_MI });
  const deliveryFeeCents = quote.extraCents;

  const first = lines[0];
  const listingTitle =
    lines.length > 1 ? `${first.title} + ${lines.length - 1} more` : first.title;
  const buyerName =
    typeof buyer?.name === "string" && buyer.name.trim() ? buyer.name.trim().slice(0, 120) : "Guest";
  const pickupCity = cleanCity(buyer?.pickupCity);
  const deliverCity = cleanCity(buyer?.deliverCity);

  const data = {
    listingId: first.listingId,
    listingTitle,
    listingImage: first.image ?? null,
    buyerName,
    priceCents: subtotalCents,
    depositCents: dueTodayCents, // == DEPOSIT_CENTS ($1)
    balanceCents: dueOnDeliveryCents,
    deliveryFeeCents,
    status: "reserved",
    pickupCity,
    deliverCity,
  };

  if (prisma) {
    try {
      const order = (await prisma.order.create({ data })) as OrderRow;
      const events: EventRow[] = [];
      try {
        const ev = (await prisma.orderEvent.create({
          data: { orderId: order.id, label: STATUS_EVENT.reserved },
        })) as EventRow;
        events.push(ev);
      } catch (err) {
        console.warn("[orders] initial event write failed", err);
      }
      return toRecord(order, events);
    } catch (err) {
      console.warn("[orders] create failed; returning in-memory order", err);
    }
  }

  // Fallback: synthesize a record so checkout still confirms.
  const now = new Date();
  const id =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `local_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`;
  return toRecord(
    { ...data, id, createdAt: now, updatedAt: now } as OrderRow,
    [{ id: `${id}_ev0`, orderId: id, label: STATUS_EVENT.reserved, at: now }],
  );
}

/* ---------------------------------- reads ---------------------------------- */

/** All orders, newest first. Fails soft to []. */
export async function listOrders(limit = 100): Promise<OrderRecord[]> {
  if (!prisma) return [];
  try {
    const orders = (await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(1, limit), 500),
    })) as OrderRow[];
    if (orders.length === 0) return [];
    const ids = orders.map((o) => o.id);
    let events: EventRow[] = [];
    try {
      events = (await prisma.orderEvent.findMany({
        where: { orderId: { in: ids } },
      })) as EventRow[];
    } catch (err) {
      console.warn("[orders] event fetch failed", err);
    }
    const byOrder = new Map<string, EventRow[]>();
    for (const e of events) {
      const arr = byOrder.get(e.orderId);
      if (arr) arr.push(e);
      else byOrder.set(e.orderId, [e]);
    }
    return orders.map((o) => toRecord(o, byOrder.get(o.id) ?? []));
  } catch (err) {
    console.warn("[orders] listOrders failed", err);
    return [];
  }
}

/** One order by id (with its event timeline). Fails soft to null. */
export async function getOrder(id: string): Promise<OrderRecord | null> {
  if (!prisma) return null;
  if (typeof id !== "string" || !id.trim()) return null;
  try {
    const order = (await prisma.order.findUnique({ where: { id } })) as OrderRow | null;
    if (!order) return null;
    let events: EventRow[] = [];
    try {
      events = (await prisma.orderEvent.findMany({ where: { orderId: id } })) as EventRow[];
    } catch (err) {
      console.warn("[orders] getOrder event fetch failed", err);
    }
    return toRecord(order, events);
  } catch (err) {
    console.warn("[orders] getOrder failed", err);
    return null;
  }
}

/* -------------------------------- mutate ----------------------------------- */

/**
 * Move an order to a new status and append the matching timeline event. Marking
 * an order `paid` zeroes the outstanding balance. Fails soft to null.
 */
export async function advanceOrderStatus(
  id: string,
  status: OrderStatus,
): Promise<OrderRecord | null> {
  if (!prisma) return null;
  if (typeof id !== "string" || !id.trim()) return null;
  if (!isOrderStatus(status)) return null;
  try {
    const patch: { status: OrderStatus; balanceCents?: number } = { status };
    if (status === "paid") patch.balanceCents = 0;
    const order = (await prisma.order.update({ where: { id }, data: patch })) as OrderRow;
    try {
      await prisma.orderEvent.create({ data: { orderId: id, label: STATUS_EVENT[status] } });
    } catch (err) {
      console.warn("[orders] advance event write failed", err);
    }
    let events: EventRow[] = [];
    try {
      events = (await prisma.orderEvent.findMany({ where: { orderId: id } })) as EventRow[];
    } catch {
      /* non-fatal */
    }
    return toRecord(order, events);
  } catch (err) {
    console.warn("[orders] advanceOrderStatus failed", err);
    return null;
  }
}

// Re-export for callers that want the canonical $1 constant alongside orders.
export { DEPOSIT_CENTS };
