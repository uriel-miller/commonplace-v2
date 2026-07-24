// Create-listing client helper. Thin, resilient wrapper around POST /api/listings
// plus an instant in-form payout preview. Safe to import from client components
// ("use client") — depends only on the pure fee engine and fetch.

import { computeSellerPayout, type PayoutBreakdown } from "@/lib/fees";

/* --------------------------------- types ---------------------------------- */

/** Dynamic category answers: label -> value (values may be arrays for multiselect). */
export type ListingAnswers = Record<string, string | number | Array<string | number>>;

/** Payload the sell modal collects and submits. All money in integer cents. */
export interface CreateListingPayload {
  categorySlug: string;
  categoryName: string;
  /** Seller's intended title. May be empty/weak — the API rewrites it via AI. */
  title?: string;
  priceCents: number;
  /** Lowest price the seller will accept (offers floor). */
  floorCents?: number;
  /** Original/retail price when listing at a discount. */
  originalCents?: number;
  condition?: string;
  answers?: ListingAnswers;
  photos?: string[];
  pickupAddress?: string;
  /** Optional free-form seller notes fed to the AI as context. */
  sellerContext?: string;
}

/** Shape returned by POST /api/listings (always resolves — fail-soft). */
export interface CreateListingResult {
  ok: boolean;
  id: string;
  title: string;
  description: string;
  payout: PayoutBreakdown;
  /** True when the row was written to Postgres; false = synthesized preview only. */
  persisted: boolean;
  /** Present when something degraded (AI or DB) but a usable result was returned. */
  warning?: string;
  error?: string;
}

/* ------------------------------ payout preview ----------------------------- */

/**
 * Instant, synchronous payout preview for the price field. Pure — no network.
 * Coerces bad input to 0 so it never throws while the seller is typing.
 */
export function previewPayout(
  priceCents: number,
  categorySlug: string | null | undefined,
): PayoutBreakdown {
  const cents = Number.isFinite(priceCents) && priceCents > 0 ? Math.round(priceCents) : 0;
  return computeSellerPayout({ priceCents: cents, categorySlug });
}

/* ------------------------------- submission -------------------------------- */

function localPreview(payload: CreateListingPayload, error: string): CreateListingResult {
  const title = (payload.title ?? "").trim() || `${payload.categoryName || "Item"} for sale`;
  return {
    ok: false,
    id: `local-${Date.now().toString(36)}`,
    title,
    description: "",
    payout: previewPayout(payload.priceCents, payload.categorySlug),
    persisted: false,
    error,
  };
}

async function postWithTimeout(body: string, ms = 12000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch("/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Submit a new listing. Never throws — on any failure it returns a locally
 * synthesized preview (ok:false) so the sell flow can still advance and show
 * the seller their payout. On success returns the API's { id, title, description,
 * payout } enriched with ok/persisted flags.
 */
export async function submitListing(
  payload: CreateListingPayload,
): Promise<CreateListingResult> {
  let body: string;
  try {
    body = JSON.stringify(payload);
  } catch {
    return localPreview(payload, "Could not serialize the listing payload.");
  }

  try {
    const res = await postWithTimeout(body);
    const data = (await res.json().catch(() => null)) as Partial<CreateListingResult> | null;

    if (data && typeof data.id === "string" && data.payout) {
      return {
        ok: data.ok ?? res.ok,
        id: data.id,
        title: data.title ?? (payload.title ?? "").trim(),
        description: data.description ?? "",
        payout: data.payout,
        persisted: data.persisted ?? false,
        warning: data.warning,
        error: data.error,
      };
    }
    return localPreview(payload, "The listings API returned an unexpected response.");
  } catch (err) {
    return localPreview(payload, err instanceof Error ? err.message : String(err));
  }
}
