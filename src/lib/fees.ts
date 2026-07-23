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
  // ---- Wellness ----
  "swim-spa": 219900,
  sauna: 45000, "infrared-sauna": 45000,
  "hot-tubs": 39900, "hot-tub": 39900, "hot-springs-spa": 39900, "hot-spring": 39900,
  "american-select-hot-tub": 39900, "master-spas-hot-tub": 39900,
  jacuzzi: 34900,
  "float-pod": 40000,
  "cold-plunge": 27500,
  "massage-chair": 22500, "soaking-tub": 22500, "steam-bath-generator": 22500,
  // ---- Fitness ----
  "peloton-tread-plus": 45000, "peloton-tread": 35000, "peloton-bike-and-tread": 27500,
  treadmills: 25000, "nordictrack-treadmill": 25000, "proform-treadmill": 25000,
  stairmaster: 27500, "ergatta-rower": 27500, rower: 27500, hydrow: 27500,
  "bowflex-bxt8j": 27500, "bowflex-ct200": 27500, "bowflex-treadclimber": 27500, bowflex: 27500,
  "golf-simulators": 27500,
  tonal: 22500, "tonal-home-gym": 22500, "smith-machine": 22500, reformer: 22500,
  "weight-machine": 20000, "home-gym": 20000, "home-gyms": 20000, "functional-trainer": 20000,
  "peloton-bike-2nd-gen": 20000, "peloton-bike-plus": 20000, "peloton-bike-3rd-gen": 20000,
  "spin-bike": 20000, "indoor-bikes": 20000, "assault-fitness-bike": 20000, elliptical: 20000,
  // ---- Vehicles ----
  cars: 55000, vehicles: 40000,
  "golf-carts": 34900, "golf-cart-tires": 34900,
  atv: 40000, "dirt-bike": 40000, scooters: 40000, "jet-skis": 40000, motorcycles: 22500,
  "mini-moke": 35000, "camper-vans": 35000, "rv-motorhome": 35000,
  "zero-turn-lawn-mower": 32500, "john-deere-lawn-mower": 27500, "lawn-mower": 27500,
  // ---- Appliances / furniture (common) ----
  refrigerators: 27500, "kitchen-appliances": 27500,
  "electric-range": 29900, "gas-range-stove": 29900, "professional-range": 29700,
  washer: 22500, dryer: 22500, "washer-and-dryer-set": 22500, "washer-dryer-combo": 22500, dishwasher: 22500,
  couches: 30000, "living-room-couch": 30000, "pull-out-couch": 30000,
  sofas: 20000, sectionals: 20000, "sectional-sofas": 20000, "sofa-sets": 20000,
  "pool-table": 25000, "air-hockey-table": 20000, "pinball-machine": 22500,
  "dining-tables": 20000, "entertainment-center": 20000,
  "hospital-beds": 22500, "power-wheelchairs": 22500,
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
