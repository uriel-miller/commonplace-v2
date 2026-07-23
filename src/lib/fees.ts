// Commonplace fee engine — a faithful port of the live WordPress config
// (distance-based-shipping-checkout v3.7.3 "variant/free-delivery" model,
// tms-stripe-partial-payments $1 deposit, and the seller-payout formula).
// All money is in integer cents. Sources documented in fee-structure.md.

/* --------------------------------- delivery --------------------------------- */

// Live per-mile tiers ($/mi) from dbscr_settings.
export const RATE_LE100 = 1.0; // miles 0–100 (only used by the non-variant model)
export const RATE_GT100 = 2.5; // miles 100–200
export const RATE_GT200 = 3.5; // miles beyond 200
export const CATALOG_DELIVERY_CENTS = 19900; // flat $199 for catalog products
export const DEFAULT_BASE_RATE_CENTS = 22500; // $225 default category base

const EARTH_RADIUS_MI = 3958.8;

export interface LatLng {
  lat: number;
  lng: number;
}

/** One-way straight-line distance in miles (Haversine), matching the plugin. */
export function haversineMiles(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * LIVE (variant / free-delivery) model: free within 100 mi; only the marginal
 * miles beyond 100 are charged at checkout ($2.50/mi to 200, $3.50/mi beyond).
 * Returns the buyer-facing "extra delivery beyond 100 miles" amount in cents.
 */
export function deliveryExtraCents(distanceMi: number): number {
  if (distanceMi <= 100) return 0;
  if (distanceMi <= 200) return Math.round((distanceMi - 100) * RATE_GT100 * 100);
  return Math.round((100 * RATE_GT100 + (distanceMi - 200) * RATE_GT200) * 100);
}

export interface DeliveryQuote {
  extraCents: number;
  free: boolean;
  message: string;
}

export function quoteDelivery(opts: {
  distanceMi: number;
  isCatalog?: boolean;
}): DeliveryQuote {
  if (opts.isCatalog) {
    return { extraCents: CATALOG_DELIVERY_CENTS, free: false, message: "$199 flat delivery" };
  }
  const extra = deliveryExtraCents(opts.distanceMi);
  if (extra === 0) return { extraCents: 0, free: true, message: "Free delivery (within 100 miles)" };
  const beyond = Math.round(opts.distanceMi - 100);
  return {
    extraCents: extra,
    free: false,
    message: `Free for the first 100 miles + $${(extra / 100).toLocaleString()} for ${beyond} extra miles`,
  };
}

/* --------------------------------- deposit ---------------------------------- */

export const DEPOSIT_CENTS = 100; // $1 fixed reservation
export const PREMIUM_THRESHOLD_CENTS = 800000; // $8,000 → manual wire, no auto-charge

/** True when an order is collected by manual wire (never auto-charged on delivery). */
export function isPremiumManualWire(subtotalCents: number): boolean {
  return subtotalCents >= PREMIUM_THRESHOLD_CENTS;
}

export function depositBreakdown(subtotalCents: number): {
  dueTodayCents: number;
  dueOnDeliveryCents: number;
  manualWire: boolean;
} {
  const manualWire = isPremiumManualWire(subtotalCents);
  const dueToday = DEPOSIT_CENTS;
  return {
    dueTodayCents: dueToday,
    dueOnDeliveryCents: Math.max(0, subtotalCents - dueToday),
    manualWire,
  };
}

/* ------------------------------ seller payout ------------------------------- */

export const TXN_FEE_DEFAULT = 0.2; // 20% flat
// Per-category transaction-fee overrides (from wp_termmeta.transaction_fee).
export const TXN_FEE_OVERRIDES: Record<string, number> = {
  "swim-spa": 0.3,
};
// Per-category pickup fees in cents (wp_termmeta.pick-up_fee; representative set —
// full map lives in the DB and can be imported later). Falls back to default.
export const PICKUP_FEES_CENTS: Record<string, number> = {
  "hot-tub": 39900,
  jacuzzi: 39900,
  "hot-spring": 39900,
  "swim-spa": 219900,
  sauna: 45000,
  "infrared-sauna": 45000,
  "cold-plunge": 35000,
  "peloton-tread": 35000,
  "peloton-tread-plus": 35000,
  treadmills: 20000,
  tonal: 25000,
  "golf-carts": 25000,
  cars: 0,
};
export const PICKUP_FEE_DEFAULT_CENTS = 19900;

export function txnFeeRate(categorySlug: string | null | undefined): number {
  if (!categorySlug) return TXN_FEE_DEFAULT;
  return TXN_FEE_OVERRIDES[categorySlug] ?? TXN_FEE_DEFAULT;
}

export function pickupFeeCents(categorySlug: string | null | undefined): number {
  if (!categorySlug) return PICKUP_FEE_DEFAULT_CENTS;
  return PICKUP_FEES_CENTS[categorySlug] ?? PICKUP_FEE_DEFAULT_CENTS;
}

export interface PayoutBreakdown {
  priceCents: number;
  txnFeeCents: number;
  pickupFeeCents: number;
  payoutCents: number;
  freePickup: boolean;
}

/** Seller payout = price − (txn% × price) − pickup fee. Matches class-cpal-payout.php. */
export function computeSellerPayout(opts: {
  priceCents: number;
  categorySlug: string | null | undefined;
  pickupOverrideCents?: number;
}): PayoutBreakdown {
  const rate = txnFeeRate(opts.categorySlug);
  const txn = Math.round(opts.priceCents * rate);
  const pickup = opts.pickupOverrideCents ?? pickupFeeCents(opts.categorySlug);
  const payout = opts.priceCents - txn - pickup;
  return {
    priceCents: opts.priceCents,
    txnFeeCents: txn,
    pickupFeeCents: pickup,
    payoutCents: Math.max(0, payout),
    freePickup: payout < 0,
  };
}
