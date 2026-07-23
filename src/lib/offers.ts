// Offers engine — server functions for buyer↔seller negotiation on a Listing.
// Money is in integer cents. Every DB call null-checks `prisma` and degrades
// to a safe empty result (site runs at scale; a missing DB must never throw).
//
// Consumed by the /api/offers routes and (via those) the OfferModal / OffersList
// client components. Pure server module — do not import into client code.

import { prisma } from "@/lib/db";

/** Lifecycle of an offer. Plain string enum stored on Offer.status. */
export type OfferStatus = "pending" | "accepted" | "countered" | "declined";

/** Seller action on an existing offer. */
export type OfferAction = "accept" | "counter" | "decline";

/** Shape returned to the UI — a superset of the Prisma row, always plain JSON. */
export interface OfferDTO {
  id: string;
  listingId: number;
  listingTitle: string;
  listingImage: string | null;
  buyerName: string;
  buyerState: string | null;
  amountCents: number;
  listPriceCents: number;
  status: OfferStatus;
  counterCents: number | null;
  message: string | null;
  createdAt: string;
  updatedAt: string;
  /** amountCents / listPriceCents as a rounded whole percent (0–100+), for display. */
  pctOfAsking: number;
}

export interface CreateOfferInput {
  listingId: number;
  listingTitle: string;
  listingImage?: string | null;
  buyerName: string;
  buyerState?: string | null;
  amountCents: number;
  listPriceCents: number;
  message?: string | null;
}

export interface CreateOfferResult {
  ok: boolean;
  offer: OfferDTO | null;
  error?: string;
}

const VALID_STATUSES: readonly OfferStatus[] = [
  "pending",
  "accepted",
  "countered",
  "declined",
];

function coerceStatus(s: unknown): OfferStatus {
  return typeof s === "string" && (VALID_STATUSES as readonly string[]).includes(s)
    ? (s as OfferStatus)
    : "pending";
}

function pctOf(amountCents: number, listPriceCents: number): number {
  if (!Number.isFinite(listPriceCents) || listPriceCents <= 0) return 0;
  return Math.round((amountCents / listPriceCents) * 100);
}

/** Normalize a Prisma Offer row (loosely typed) into a stable DTO. */
function toDTO(row: {
  id: string;
  listingId: number;
  listingTitle: string;
  listingImage: string | null;
  buyerName: string;
  buyerState: string | null;
  amountCents: number;
  listPriceCents: number;
  status: string;
  counterCents: number | null;
  message: string | null;
  createdAt: Date;
  updatedAt: Date;
}): OfferDTO {
  return {
    id: row.id,
    listingId: row.listingId,
    listingTitle: row.listingTitle,
    listingImage: row.listingImage ?? null,
    buyerName: row.buyerName,
    buyerState: row.buyerState ?? null,
    amountCents: row.amountCents,
    listPriceCents: row.listPriceCents,
    status: coerceStatus(row.status),
    counterCents: row.counterCents ?? null,
    message: row.message ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    pctOfAsking: pctOf(row.amountCents, row.listPriceCents),
  };
}

/** Round + clamp a cents value to a safe non-negative integer. */
function safeCents(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function safeStr(v: unknown, max = 2000): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

/**
 * Validate + parse an unknown request body into CreateOfferInput.
 * Returns null when the input is unusable (missing listing / non-positive offer).
 */
export function parseCreateOfferInput(body: unknown): CreateOfferInput | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;

  const listingId = Number(b.listingId);
  if (!Number.isFinite(listingId) || listingId <= 0) return null;

  const amountCents = safeCents(b.amountCents);
  if (amountCents <= 0) return null;

  const listPriceCents = safeCents(b.listPriceCents);

  const listingTitle = safeStr(b.listingTitle, 300) ?? "Listing";
  const buyerName = safeStr(b.buyerName, 120) ?? "Guest buyer";

  return {
    listingId: Math.round(listingId),
    listingTitle,
    listingImage: safeStr(b.listingImage, 1000),
    buyerName,
    buyerState: safeStr(b.buyerState, 40),
    amountCents,
    listPriceCents,
    message: safeStr(b.message, 2000),
  };
}

/**
 * Create a buyer offer. Null-checks prisma; on any failure returns
 * { ok:false, offer:null } rather than throwing.
 */
export async function createOffer(input: CreateOfferInput): Promise<CreateOfferResult> {
  if (!prisma) {
    return { ok: false, offer: null, error: "no-database" };
  }
  try {
    const row = await prisma.offer.create({
      data: {
        listingId: input.listingId,
        listingTitle: input.listingTitle,
        listingImage: input.listingImage ?? null,
        buyerName: input.buyerName,
        buyerState: input.buyerState ?? null,
        amountCents: input.amountCents,
        listPriceCents: input.listPriceCents,
        status: "pending",
        message: input.message ?? null,
      },
    });
    return { ok: true, offer: toDTO(row) };
  } catch (err) {
    console.warn("[offers] createOffer failed", err);
    return { ok: false, offer: null, error: "create-failed" };
  }
}

/**
 * All offers the buyer has placed, newest first. Fail-soft to [].
 * (Single-tenant demo scope: buyer sees every offer. A real auth layer would
 * filter by the signed-in buyer id — kept forward-compatible via the arg.)
 */
export async function listOffersForBuyer(buyerName?: string): Promise<OfferDTO[]> {
  if (!prisma) return [];
  try {
    const rows = await prisma.offer.findMany({
      where: buyerName ? { buyerName } : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return rows.map(toDTO);
  } catch (err) {
    console.warn("[offers] listOffersForBuyer failed", err);
    return [];
  }
}

/**
 * All offers awaiting the seller (and their resolved history), newest first.
 * Fail-soft to []. Pending offers are surfaced first so the seller acts on
 * live negotiations before reviewing closed ones.
 */
export async function listOffersForSeller(): Promise<OfferDTO[]> {
  if (!prisma) return [];
  try {
    const rows = await prisma.offer.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    const dtos = rows.map(toDTO);
    // Stable sort: pending first, then everything else by recency (already sorted).
    return dtos.sort((a, b) => {
      const ap = a.status === "pending" ? 0 : 1;
      const bp = b.status === "pending" ? 0 : 1;
      return ap - bp;
    });
  } catch (err) {
    console.warn("[offers] listOffersForSeller failed", err);
    return [];
  }
}

export interface RespondResult {
  ok: boolean;
  offer: OfferDTO | null;
  error?: string;
}

/**
 * Seller responds to an offer:
 *   accept  → status "accepted"
 *   decline → status "declined"
 *   counter → status "countered", counterCents set (must be > 0)
 * Null-checks prisma, validates the transition, and fail-softs.
 */
export async function respondToOffer(
  id: string,
  action: OfferAction,
  counterCents?: number,
): Promise<RespondResult> {
  if (!prisma) return { ok: false, offer: null, error: "no-database" };
  if (!id || typeof id !== "string") {
    return { ok: false, offer: null, error: "bad-id" };
  }
  if (action !== "accept" && action !== "counter" && action !== "decline") {
    return { ok: false, offer: null, error: "bad-action" };
  }

  let data: { status: OfferStatus; counterCents?: number };
  if (action === "accept") {
    data = { status: "accepted" };
  } else if (action === "decline") {
    data = { status: "declined" };
  } else {
    const c = safeCents(counterCents);
    if (c <= 0) return { ok: false, offer: null, error: "bad-counter" };
    data = { status: "countered", counterCents: c };
  }

  try {
    const row = await prisma.offer.update({ where: { id }, data });
    return { ok: true, offer: toDTO(row) };
  } catch (err) {
    console.warn("[offers] respondToOffer failed", err);
    return { ok: false, offer: null, error: "update-failed" };
  }
}
