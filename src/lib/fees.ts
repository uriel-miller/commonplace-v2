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

/* ------------------------------ delivery base rate ------------------------------
 * Per-category delivery base rate ($), ported from the live distance-shipping
 * plugin option dbscr_settings.category_rates (default $225). It feeds the
 * beyond-100-mile delivery quote; within 100 miles delivery stays free (the
 * Commonplace promo). Delivery is a BUYER cost — it is NOT deducted from the
 * seller payout (that formula is price − transaction% − pickup, see the live
 * CPAL_Payout plugin). */
export const DELIVERY_BASE_DEFAULT_CENTS = 22500; // $225 default_base_rate
export const DELIVERY_BASE_CENTS: Record<string, number> = {
  "hot-tubs": 59900,
  "swim-spa": 219900,
  "sauna": 45000,
  "refrigerators": 37500,
  "washer": 25000,
  "dryer": 25000,
  "dishwasher": 25000,
  "electric-range": 27400,
  "scooters": 35000,
  "vehicles": 40000,
  "atv": 40000,
  "cars": 39900,
  "rv-motorhome": 39900,
  "golf-carts": 34900,
  "lawn-mower": 30000,
  "massage-chair": 27500,
  "cold-plunge": 27500,
  "elliptical": 27500,
  "dining-tables": 17500,
  "coffee-tables": 10000,
  // Peloton family delivery.
  "peloton-bike-2nd-gen": 15000,
  "peloton-bike-plus": 15000,
  "peloton-tread": 29900,
  "peloton-tread-plus": 40000,
};

/** Per-category delivery base rate in cents (default $225). */
export function deliveryBaseCents(categorySlug: string | null | undefined): number {
  if (!categorySlug) return DELIVERY_BASE_DEFAULT_CENTS;
  return DELIVERY_BASE_CENTS[categorySlug] ?? DELIVERY_BASE_DEFAULT_CENTS;
}

export interface DeliveryQuote {
  extraCents: number;
  free: boolean;
  message: string;
}

export function quoteDelivery(opts: {
  distanceMi: number;
  isCatalog?: boolean;
  categorySlug?: string | null;
}): DeliveryQuote {
  if (opts.isCatalog) {
    return { extraCents: CATALOG_DELIVERY_CENTS, free: false, message: "$199 flat delivery" };
  }
  const marginal = deliveryExtraCents(opts.distanceMi);
  if (marginal === 0) return { extraCents: 0, free: true, message: "Free delivery (within 100 miles)" };
  // Beyond the free 100-mile zone: the category's delivery base rate + marginal miles.
  const total = deliveryBaseCents(opts.categorySlug) + marginal;
  const beyond = Math.round(opts.distanceMi - 100);
  return {
    extraCents: total,
    free: false,
    message: `Free for the first 100 miles + $${(total / 100).toLocaleString()} beyond (${beyond} mi)`,
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
// Verified against the live Fee Manager: only two categories deviate from 20%.
export const TXN_FEE_OVERRIDES: Record<string, number> = {
  "swim-spa": 0.3,
  "golf-carts": 0.25,
};
// FULL per-category pickup-fee map — ported verbatim from wp_termmeta.pick-up_fee
// on the live Fee Manager (392 categories, dollars x100 = cents). Falls back to
// PICKUP_FEE_DEFAULT_CENTS for any slug not present.
export const PICKUP_FEES_CENTS: Record<string, number> = {
  "abdominal-bench": 12500,
  "actbest-mars-folding-ebike": 12500,
  "addons": 7500,
  "adjustable-bench": 12500,
  "aeroski-ski-machine": 12500,
  "air-compression-leg-massager": 10000,
  "air-conditioner": 17500,
  "air-hockey-table": 20000,
  "american-select-hot-tub": 39900,
  "anatomical-models": 10000,
  "appliance": 20000,
  "armchairs": 15000,
  "ashley-furniture-set": 20000,
  "assault-fitness-bike": 12500,
  "atari-vintage-console": 10000,
  "atv": 40000,
  "aviron-rower": 12500,
  "aviron-treadmill": 25000,
  "baby-furniture": 15000,
  "backyard-playset": 20000,
  "bar-cart": 10000,
  "barstools": 10000,
  "bed-extender": 15000,
  "bed-frames": 15000,
  "bedding-set": 10000,
  "bedroom-sets": 20000,
  "beds": 20000,
  "benches": 15000,
  "bicycles": 15000,
  "billiards-table": 20000,
  "bistro-tables": 15000,
  "blankets": 10000,
  "body-sculpting-machine": 17500,
  "body-solid-home-gym": 20000,
  "books-media": 10000,
  "bookshelves": 15000,
  "booty-max-trainer": 12500,
  "bowflex-300": 20000,
  "bowflex-bxt8j": 27500,
  "bowflex-ct200": 27500,
  "bowflex-home-gym": 20000,
  "bowflex-ic-bike-se": 12500,
  "bowflex-imax": 15000,
  "bowflex-lateral-trainer": 12500,
  "bowflex-max-trainer": 12500,
  "bowflex-tower": 20000,
  "bowflex-treadclimber": 27500,
  "boxing-bag": 15000,
  "brava-fitness-equipment": 17500,
  "breakthrough-5-plus": 15000,
  "brewer-cabinet-shelved": 15000,
  "brompton-folding-bike": 12500,
  "brute-force-360ptx": 17500,
  "buenospa-device": 22500,
  "bull-bar": 10000,
  "bullfrog-x8-fitness-device": 17500,
  "cabinets": 15000,
  "cable-functional-trainer-machine": 25000,
  "camper-vans": 35000,
  "car-headrest": 10000,
  "car-seat": 15000,
  "cardio": 17500,
  "cars": 55000,
  "cat-supplies": 10000,
  "catrike-559-recumbent-trike": 25000,
  "century-wavemaster": 15000,
  "chair-gym": 17500,
  "chairs": 15000,
  "chairs-and-ottomans": 10000,
  "chandelier": 10000,
  "chevrolet-silverado-door": 25000,
  "chevy-tahoe-parts": 25000,
  "china-cabinet": 20000,
  "christmas-tree": 20000,
  "cleaning-equipment": 15000,
  "climbr-vertical-climber": 15000,
  "clinic-retail-display-fixtures": 15000,
  "clothing-accessories": 10000,
  "clothing-bundles": 10000,
  "coat-hanger": 10000,
  "coffee-tables": 10000,
  "cold-plunge": 27500,
  "collectibles": 10000,
  "console-table": 10000,
  "coolers": 15000,
  "corday-lamp": 10000,
  "couch-and-bed-set": 30000,
  "couch-loveseat-and-ottoman-set": 30000,
  "couches": 30000,
  "counter-height-table-set": 20000,
  "cowhide-rug": 10000,
  "cryolipolysis": 22500,
  "cubicle-system": 25000,
  "cybex-arc-trainer": 17500,
  "desks": 15000,
  "diagnostic-skin-imaging-systems": 22500,
  "dining-roll": 20000,
  "dining-sets": 20000,
  "dining-table-and-chairs-set": 20000,
  "dining-tables": 20000,
  "dirt-bike": 40000,
  "dishwasher": 25000,
  "display-cases": 20000,
  "doors": 20000,
  "double-wall-oven": 17500,
  "dressers": 15000,
  "dressers-chests": 15000,
  "drones": 10000,
  "dryer": 25000,
  "dumbbells": 15000,
  "dyna-pack-2000": 17500,
  "e-bike": 15000,
  "e-trike": 15000,
  "earbuds": 10000,
  "egofit-fitness-equipment": 17500,
  "ekg-machine": 12500,
  "electric-ebike": 15000,
  "electric-fireplace": 15000,
  "electric-range": 32400,
  "electric-range-microwave-and-dishwasher-set": 34900,
  "electric-scooter": 15000,
  "electronics": 10000,
  "elevare-fitness-device": 17500,
  "elliptical": 17500,
  "entertainment-center": 20000,
  "entryway-furniture-set": 20000,
  "ergatta-rower": 27500,
  "exercise-bike": 12500,
  "fightcamp-boxing-equipment": 15000,
  "fire-pit-table": 20000,
  "float-pod": 40000,
  "floor-lamp": 10000,
  "flower-wall-decor": 10000,
  "focus-pads": 10000,
  "food-beverages": 10000,
  "food-truck": 55000,
  "fractional-ablative-lasers": 22500,
  "fur-therapy-device": 10000,
  "furniture": 15000,
  "furniture-store-items": 15000,
  "gas-range-stove": 29900,
  "general-exercise-equipment": 15000,
  "general-furniture": 15000,
  "general-sale-item": 10000,
  "generator": 17500,
  "glassware": 10000,
  "golf-cart-tires": 34900,
  "golf-carts": 34900,
  "golf-clubs": 10000,
  "golf-simulators": 27500,
  "grandfather-clocks": 15000,
  "grill": 20000,
  "gym-equipment": 17500,
  "hair-removal-lasers": 22500,
  "hall-tree": 15000,
  "handcrafted-items": 10000,
  "harlequin-semi-sprung-dance-floor": 25000,
  "hathaway-excalibur-foosball-table": 20000,
  "headboards": 12500,
  "heliflex-fitness-equipment": 15000,
  "helix-lateral-trainer": 15000,
  "hieha-fitness-equipment": 15000,
  "home-gyms": 20000,
  "horizon-cardio-equipment": 15000,
  "hospital-beds": 22500,
  "hot-springs-spa": 39900,
  "hot-tubs": 39900,
  "hp-data-server": 25000,
  "huffy-bicycle": 12500,
  "humidifier": 10000,
  "hurricane-lamps": 10000,
  "hydrodermabrasion-fluid-facials": 17500,
  "hydrow-pro-rowing-machine": 17500,
  "hydrow-rower": 17500,
  "ice-cream-maker": 10000,
  "in-review": 17500,
  "indoor-bikes": 12500,
  "inner-outer-thigh-machine": 17500,
  "inspire-m2-home-gym": 20000,
  "invisa-red-device": 17500,
  "ipl-with-radio-frequency-device": 17500,
  "it-equipment": 10000,
  "jacobs-ladder-climber": 17500,
  "jacuzzi": 34900,
  "jenson-fitness-equipment": 17500,
  "jet-skis": 40000,
  "john-deere-lawn-mower": 27500,
  "jonathan-adler-decor": 10000,
  "khs-bike": 12500,
  "kinesis-fitness-equipment": 17500,
  "kitchen-appliances": 27500,
  "kitchen-faucet": 10000,
  "kitchen-laundry-appliance-package": 20000,
  "kitchen-lights": 10000,
  "knee-scooter": 15000,
  "laser-plume-evacuation-systems-smoke-evacuators": 17500,
  "led-therapy-photodynamic-devices": 10000,
  "lg-washer-and-dryer-set": 22500,
  "lifefitness-aspire": 17500,
  "livestock": 55000,
  "living-room-couch": 30000,
  "living-room-furniture-set": 20000,
  "living-room-sets": 20000,
  "loveseats": 15000,
  "luxury-sectional-sofa": 20000,
  "macfox-m16": 17500,
  "makeup-vanity": 10000,
  "massage-chair": 22500,
  "massage-table": 20000,
  "master-spas-hot-tub": 39900,
  "mattresses": 20000,
  "media-console": 10000,
  "medical-exam-tables": 15000,
  "medical-refrigeration-injectable-storage": 15000,
  "medical-spa": 15000,
  "metal-gates": 20000,
  "microcurrent-machines": 12500,
  "microdermabrasion-crystal-diamond": 10000,
  "mini-moke": 35000,
  "mirror-by-lululemon": 12500,
  "mirrors": 12500,
  "modular-sectionals": 20000,
  "montague-urban-folding-bike": 15000,
  "motorcycles": 22500,
  "mototec-minibike": 25000,
  "mountain-bike": 15000,
  "musical-instruments": 15000,
  "nightstands": 10000,
  "nordictrack-commercial-1750-treadmill": 25000,
  "nordictrack-commercial-2450-treadmill": 25000,
  "nordictrack-equipment": 20000,
  "nordictrack-s22i-studio-cycle": 15000,
  "nordictrack-ski-machine": 17500,
  "nordictrack-treadmill": 25000,
  "office-supplies": 10000,
  "omni-massage-device": 10000,
  "omnia-wellness-device": 10000,
  "other": 15000,
  "other-gym-equipment": 17500,
  "outdoor-patio-chair-set-with-table": 20000,
  "outdoors": 20000,
  "peak-pilates-mve-split-pedal-chair": 15000,
  "peloton-bike-2021": 15000,
  "peloton-bike-2nd-gen": 15000,
  "peloton-bike-3rd-gen": 15000,
  "peloton-bike-and-tread": 27500,
  "peloton-bike-original-2020": 15000,
  "peloton-bike-plus": 15000,
  "peloton-monitor": 10000,
  "peloton-row": 20000,
  "peloton-tablet": 10000,
  "peloton-tread": 35000,
  "peloton-tread-plus": 45000,
  "persian-rug": 15000,
  "pet-playpens": 10000,
  "photodynamic-devices": 10000,
  "pico-laser": 10000,
  "pilates-chair-and-accessories": 15000,
  "pinball-machine": 22500,
  "planters": 10000,
  "pool-heater": 27500,
  "pool-pump": 17500,
  "pool-table": 25000,
  "pos-and-clinic-hardware-complete-sets": 17500,
  "pottery-barn-furniture": 20000,
  "power-reclining-sofa": 22500,
  "power-tower": 12500,
  "power-wheelchairs": 22500,
  "powertech-strength-extreme-workout": 20000,
  "preacher-curl-bench": 17500,
  "pressure-washer": 15000,
  "printer": 10000,
  "professional-range": 29700,
  "proform-fitness-equipment": 17500,
  "proform-hiit-h14": 17500,
  "proform-treadmill": 25000,
  "prone-board": 10000,
  "proprietary-consumables-high-value-handpieces": 10000,
  "pub-table-and-stools": 20000,
  "pull-out-couch": 30000,
  "push-up-bike": 15000,
  "pvolve-equipment": 10000,
  "q-switched-laser": 10000,
  "queen-bed-and-mattress": 22500,
  "reading-chair": 15000,
  "recliners": 20000,
  "recumbent-stepper": 17500,
  "reformer": 22500,
  "refrigerators": 30000,
  "rf-microneedling-devices": 10000,
  "rf-radiofrequency-body-sculpting": 12500,
  "robotic-lawn-mower": 15000,
  "rogue-strength-equipment": 17500,
  "rogue-universal-storage-system": 17500,
  "roll-road-emma-3-0": 12500,
  "rower": 17500,
  "s-shape-fitness-device": 15000,
  "samsung-galaxy-a34-5g": 10000,
  "sanitizers": 10000,
  "sauna": 45000,
  "schwinn-bike": 15000,
  "scooters": 40000,
  "sculptures": 12500,
  "sectional-sofas": 20000,
  "sectionals": 20000,
  "sewing-machines": 15000,
  "shed": 25000,
  "side-steps": 25000,
  "sideboards": 15000,
  "silhouette-cameo-pro-4": 17500,
  "single-wall-oven": 15000,
  "slushie-maker": 15000,
  "smart-home-hub": 10000,
  "smart-mirror-interactive-fitness-display": 12500,
  "smart-thermostat": 10000,
  "smartwatches": 10000,
  "smith-machine": 22500,
  "smrtft-nuobell-adjustable-dumbbells": 15000,
  "soaking-tub": 22500,
  "sofa-sets": 20000,
  "sofas": 20000,
  "sole-e25-elliptical": 17500,
  "solo-stove": 15000,
  "spacetouch-revive-massager": 10000,
  "sparbar-boxing-equipment": 12500,
  "speed-ladder": 10000,
  "speedflex-fitness-machine": 17500,
  "spice-rack": 10000,
  "sportpath-intensity-stride-ramp-endurance-520e": 17500,
  "squat-rack": 12500,
  "stage-200p-fitness-equipment": 12500,
  "stair-stepper": 12500,
  "stairmaster": 27500,
  "standing-desk-treadmill": 25000,
  "steam-bath-generator": 22500,
  "storage-sets": 15000,
  "storage-stand": 15000,
  "street-rod": 40000,
  "strength": 17500,
  "string-trimmers": 10000,
  "sunlight-therapy-device": 10000,
  "swim-spa": 219900,
  "table-lamps": 10000,
  "tables": 20000,
  "taxi-accessories": 10000,
  "technogym-posterior-flexibility-machine": 17500,
  "teeter-inversion-table": 15000,
  "television": 15000,
  "thaile-fitness-equipment": 12500,
  "tidal-tank": 15000,
  "toilet-bowl": 15000,
  "tonal-home-gym": 22500,
  "tools-hardware": 10000,
  "toro-timecutter-max": 40000,
  "toys": 10000,
  "trampoline": 20000,
  "trap-bar": 15000,
  "treadmills": 25000,
  "tree-frog-playground": 40000,
  "trek-domane-al2": 12500,
  "trek-madone-7": 15000,
  "tv-stands": 15000,
  "ultralight-bicycle": 15000,
  "uncategorized": 15000,
  "upper-body-ergometer": 12500,
  "valencia-server": 15000,
  "vanity-1920s": 10000,
  "vehicles": 40000,
  "vertimax-training-system": 25000,
  "vibration-plate": 12500,
  "vibration-platform": 15000,
  "video-game": 10000,
  "vietri-solimene-dinnerware": 10000,
  "vintage-porcelain-water-pitcher": 10000,
  "wall-art": 12500,
  "wall-hangings": 12500,
  "wall-sheets": 12500,
  "wardrobes": 20000,
  "washer": 25000,
  "washer-and-dryer-combo": 22500,
  "washer-and-dryer-set": 22500,
  "washer-dryer-combo": 22500,
  "washes-and-dryers": 22500,
  "washing-machine-and-dryer-set": 22500,
  "water-purifier": 15000,
  "weight-machine": 20000,
  "wellness": 17500,
  "wheels-and-tires": 15000,
  "wine-cabinet": 20000,
  "woven-rug": 10000,
  "wrought-iron-patio-set": 20000,
  "zero-turn-lawn-mower": 32500,

  // ---- v2 curated mega-menu slugs (data.ts) that aren't standalone Fee
  // Manager categories on live. Each is mapped to the pick-up fee of its
  // closest live equivalent so browsable categories never fall to the default.
  "peloton": 15000,                 // = peloton-bike-2nd-gen ($150)
  "concept2": 17500,                // rowing pickup $175 (all rowers except Peloton Row)
  "ergatta": 17500,                 // rowing pickup $175 (all rowers except Peloton Row)
  "tonal": 17500,                   // = strength ($175, wall-mounted trainer)
  "power-rack": 17500,              // between squat-rack ($125) and smith-machine ($225)
  "cable-machine": 17500,           // = strength ($175)
  "functional-trainer": 17500,      // = strength ($175)
  "adjustable-dumbbells": 15000,    // = dumbbells ($150)
  "spin-bike": 12500,               // = exercise-bike ($125)
  "recumbent-bike": 12500,          // = exercise-bike ($125)
  "air-bike": 12500,                // = assault-fitness-bike ($125)
  "stair-climber": 17500,           // between stair-stepper ($125) and stairmaster ($275)
  "home-gym": 20000,                // = bowflex/body-solid home-gym ($200)
  "lamps": 10000,                   // = floor-lamp / table-lamps ($100)
  "rv-motorhome": 55000,            // = food-truck ($550, largest towed unit)
  "lawn-mower": 30000,              // pickup $300 (delivery $300 too)
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
