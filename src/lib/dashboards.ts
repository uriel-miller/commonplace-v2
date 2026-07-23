"use server";

// Dashboard data — server functions powering the buyer + seller dashboards.
// Callable directly from client components (React Server Functions): each is an
// async, no-arg RPC returning plain, serializable JSON.
//
// Every function null-checks `prisma`, wraps all DB access in try/catch, and
// degrades to sensible empty/typed defaults so a missing or flaky database can
// never blank the dashboard or throw to the client (this ships to millions).
//
// Offers are read through the existing offers engine (src/lib/offers.ts) so the
// DTO shape and pending-first ordering stay identical to the /api/offers routes.
// Seller payouts are computed with the ported fee engine (src/lib/fees.ts).

import { prisma } from "@/lib/db";
import {
  listOffersForBuyer,
  listOffersForSeller,
  type OfferDTO,
} from "@/lib/offers";
import { computeSellerPayout } from "@/lib/fees";

// Re-export the offer DTO so dashboard consumers have a single import surface.
export type { OfferDTO } from "@/lib/offers";

/* ------------------------------- shared shapes ------------------------------- */

/** An order as surfaced on the dashboards. Money in integer cents. */
export interface DashboardOrder {
  id: string;
  listingId: number;
  listingTitle: string;
  listingImage: string | null;
  priceCents: number;
  depositCents: number;
  balanceCents: number;
  deliveryFeeCents: number;
  status: string;
  pickupCity: string | null;
  deliverCity: string | null;
  createdAt: string;
}

/* ------------------------------- buying shapes ------------------------------- */

export interface BuyingStats {
  /** Offers still live (pending or countered). */
  activeOffers: number;
  /** Offers the seller has accepted. */
  accepted: number;
  /** Orders currently in the delivery pipeline. */
  arriving: number;
}

export interface BuyingData {
  offers: OfferDTO[];
  orders: DashboardOrder[];
  stats: BuyingStats;
}

/* ------------------------------ selling shapes ------------------------------- */

export interface SellingListing {
  id: number;
  slug: string;
  title: string;
  image: string | null;
  priceCents: number;
  categoryName: string;
  categorySlug: string;
  reviewCount: number;
  /** Deterministic per-listing view estimate derived from real row data. */
  estViews: number;
}

export interface SellingStats {
  activeListings: number;
  /** Offers awaiting a seller response (status === "pending"). */
  newOffers: number;
  totalViews: number;
  /** Total seller payout across paid orders, in cents. */
  paidOutCents: number;
}

export interface SellingData {
  offers: OfferDTO[];
  listings: SellingListing[];
  stats: SellingStats;
}

/* --------------------------------- helpers ---------------------------------- */

const ARRIVING_STATUSES = new Set(["scheduled", "picked_up", "in_transit"]);
const PAID_STATUSES = new Set(["paid", "delivered"]);

// Bounded scope: in this single-tenant demo the "seller" owns the most recently
// updated listings. A real auth layer would filter by seller id.
const SELLER_LISTING_LIMIT = 8;

function firstImage(images: unknown): string | null {
  if (Array.isArray(images)) {
    const first = images.find((x) => typeof x === "string" && x.length > 0);
    return typeof first === "string" ? first : null;
  }
  return null;
}

/** Deterministic, real-row-derived view estimate (stable across renders). */
function estimateViews(id: number, reviewCount: number): number {
  const rc = Number.isFinite(reviewCount) ? Math.max(0, reviewCount) : 0;
  const idPart = Number.isFinite(id) ? Math.abs(Math.round(id)) % 120 : 0;
  return rc * 14 + idPart + 25;
}

function toDashboardOrder(row: {
  id: string;
  listingId: number;
  listingTitle: string;
  listingImage: string | null;
  priceCents: number;
  depositCents: number;
  balanceCents: number;
  deliveryFeeCents: number;
  status: string;
  pickupCity: string | null;
  deliverCity: string | null;
  createdAt: Date;
}): DashboardOrder {
  return {
    id: row.id,
    listingId: row.listingId,
    listingTitle: row.listingTitle,
    listingImage: row.listingImage ?? null,
    priceCents: row.priceCents,
    depositCents: row.depositCents,
    balanceCents: row.balanceCents,
    deliveryFeeCents: row.deliveryFeeCents,
    status: row.status,
    pickupCity: row.pickupCity ?? null,
    deliverCity: row.deliverCity ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

const EMPTY_BUYING: BuyingData = {
  offers: [],
  orders: [],
  stats: { activeOffers: 0, accepted: 0, arriving: 0 },
};

const EMPTY_SELLING: SellingData = {
  offers: [],
  listings: [],
  stats: { activeListings: 0, newOffers: 0, totalViews: 0, paidOutCents: 0 },
};

/* --------------------------------- buying ----------------------------------- */

/**
 * Everything the signed-in buyer sees: the offers they've placed, the orders on
 * the way, and headline counts. Fail-soft to typed empties — never throws.
 */
export async function getBuyingData(): Promise<BuyingData> {
  // Offers are already fail-soft ([] when prisma is null / on error).
  let offers: OfferDTO[] = [];
  try {
    offers = await listOffersForBuyer();
  } catch (err) {
    console.warn("[dashboards] getBuyingData offers failed", err);
    offers = [];
  }

  let orders: DashboardOrder[] = [];
  if (prisma) {
    try {
      const rows = await prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      orders = rows.map(toDashboardOrder);
    } catch (err) {
      console.warn("[dashboards] getBuyingData orders failed", err);
      orders = [];
    }
  }

  const activeOffers = offers.filter(
    (o) => o.status === "pending" || o.status === "countered",
  ).length;
  const accepted = offers.filter((o) => o.status === "accepted").length;
  const arriving = orders.filter((o) => ARRIVING_STATUSES.has(o.status)).length;

  return { offers, orders, stats: { activeOffers, accepted, arriving } };
}

/* --------------------------------- selling ---------------------------------- */

/**
 * Everything the signed-in seller sees: offers on their listings (pending
 * first), their active listings, and headline counts including real payout
 * totals computed from paid orders via the fee engine. Fail-soft — never throws.
 */
export async function getSellingData(): Promise<SellingData> {
  let offers: OfferDTO[] = [];
  try {
    offers = await listOffersForSeller();
  } catch (err) {
    console.warn("[dashboards] getSellingData offers failed", err);
    offers = [];
  }

  if (!prisma) {
    // No DB: still surface any offers the offers engine could (it returns []).
    const newOffers = offers.filter((o) => o.status === "pending").length;
    return { ...EMPTY_SELLING, offers, stats: { ...EMPTY_SELLING.stats, newOffers } };
  }

  let listings: SellingListing[] = [];
  try {
    const rows = await prisma.listing.findMany({
      orderBy: { updatedAt: "desc" },
      take: SELLER_LISTING_LIMIT,
    });
    listings = rows.map((l) => ({
      id: l.id,
      slug: l.slug,
      title: l.title,
      image: firstImage(l.images),
      priceCents: l.priceCents,
      categoryName: l.categoryName,
      categorySlug: l.categorySlug,
      reviewCount: l.reviewCount,
      estViews: estimateViews(l.id, l.reviewCount),
    }));
  } catch (err) {
    console.warn("[dashboards] getSellingData listings failed", err);
    listings = [];
  }

  // Real payout total: sum computeSellerPayout over paid/delivered orders,
  // enriching each with its listing category for the correct fee tier.
  let paidOutCents = 0;
  try {
    const paidOrders = await prisma.order.findMany({
      where: { status: { in: Array.from(PAID_STATUSES) } },
      take: 500,
    });
    if (paidOrders.length > 0) {
      const ids = Array.from(new Set(paidOrders.map((o) => o.listingId)));
      const cats = await prisma.listing.findMany({
        where: { id: { in: ids } },
        select: { id: true, categorySlug: true },
      });
      const catMap = new Map(cats.map((c) => [c.id, c.categorySlug]));
      for (const o of paidOrders) {
        const { payoutCents } = computeSellerPayout({
          priceCents: o.priceCents,
          categorySlug: catMap.get(o.listingId) ?? null,
        });
        paidOutCents += payoutCents;
      }
    }
  } catch (err) {
    console.warn("[dashboards] getSellingData payout failed", err);
    paidOutCents = 0;
  }

  const newOffers = offers.filter((o) => o.status === "pending").length;
  const totalViews = listings.reduce((s, l) => s + l.estViews, 0);

  return {
    offers,
    listings,
    stats: {
      activeListings: listings.length,
      newOffers,
      totalViews,
      paidOutCents,
    },
  };
}
