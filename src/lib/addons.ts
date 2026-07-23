// Category-specific cart add-ons (warranties + accessories) for the in-cart
// upsell pop-up. Framework-agnostic and dependency-free so it is safe to import
// from anywhere. Every export is fail-soft: bad input degrades to the generic
// set or an empty list, never a throw.

import type { Listing } from "./listing";

export type AddonKind = "warranty" | "accessory";

export interface Addon {
  /** Stable string key (also seeds the synthetic listing id). */
  key: string;
  title: string;
  blurb: string;
  priceCents: number;
  kind: AddonKind;
}

/* ------------------------------------------------------------------ */
/* Warranties — offered on every order                                */
/* ------------------------------------------------------------------ */
const WARRANTIES: Addon[] = [
  { key: "warranty-1yr", kind: "warranty", title: "1-Year Protection Plan", blurb: "Parts & labor coverage for a full year after delivery.", priceCents: 9900 },
  { key: "warranty-2yr", kind: "warranty", title: "2-Year Protection Plan", blurb: "Two years of coverage — most popular for big-ticket items.", priceCents: 17900 },
  { key: "warranty-3yr", kind: "warranty", title: "3-Year Protection Plan", blurb: "Maximum peace of mind — three full years, fully transferable.", priceCents: 24900 },
];

/* ------------------------------------------------------------------ */
/* Accessories — keyed by category slug (with sensible family reuse)   */
/* ------------------------------------------------------------------ */
const A = (key: string, title: string, blurb: string, priceCents: number): Addon => ({ key, title, blurb, priceCents, kind: "accessory" });

const BIKE_ACC: Addon[] = [
  A("acc-cycling-shoes", "Cycling Shoes", "Clip-in shoes sized to your fit, delivered with the bike.", 12500),
  A("acc-bike-mat", "Protective Floor Mat", "Keeps your floors safe and the ride stable.", 5900),
  A("acc-dumbbells", "Dumbbell Set", "Light hand weights for on-bike strength work.", 4500),
  A("acc-hrm", "Heart-Rate Monitor", "Bluetooth armband for accurate zones.", 4900),
];
const TREAD_ACC: Addon[] = [
  A("acc-tread-mat", "Treadmill Floor Mat", "Dampens noise and protects your floor.", 6900),
  A("acc-lube-kit", "Belt Lubricant Kit", "Keeps the deck smooth and quiet for years.", 2900),
];
const ROW_ACC: Addon[] = [
  A("acc-row-cushion", "Seat Cushion", "Extra padding for longer rows.", 3900),
  A("acc-row-mat", "Protective Floor Mat", "Protects floors and catches sweat.", 5900),
];
const HOTTUB_ACC: Addon[] = [
  A("acc-spa-cover", "Insulated Spa Cover", "Locks in heat and cuts energy costs.", 39900),
  A("acc-spa-steps", "Spa Steps", "Safe, sturdy entry step.", 9900),
  A("acc-spa-chem", "Chemical Starter Kit", "Everything to balance the water on day one.", 6900),
  A("acc-cover-lifter", "Cover Lifter", "One-person open/close for the cover.", 14900),
];
const SAUNA_ACC: Addon[] = [
  A("acc-sauna-backrest", "Ergonomic Backrest", "Comfort for longer sessions.", 7900),
  A("acc-sauna-aroma", "Aromatherapy Kit", "Bucket, ladle, and essential oils.", 4900),
];
const PLUNGE_ACC: Addon[] = [
  A("acc-plunge-chiller", "Water Chiller", "Holds your plunge at the perfect temperature.", 79900),
  A("acc-plunge-lid", "Insulated Lid", "Keeps it cold and clean between plunges.", 12900),
];
const GOLF_ACC: Addon[] = [
  A("acc-cart-cover", "Weatherproof Enclosure", "Full cover for rain and storage.", 18900),
  A("acc-cart-charger", "Fast Charger", "Faster, safer charging.", 24900),
  A("acc-cart-windshield", "Windshield", "Fold-down windshield for the front.", 13900),
];
const GYM_ACC: Addon[] = [
  A("acc-gym-mat", "Protective Floor Mat", "Protects floors under heavy equipment.", 7900),
  A("acc-gym-attach", "Attachment Kit", "Extra handles and bars for more exercises.", 8900),
];
const MASSAGE_ACC: Addon[] = [
  A("acc-chair-cover", "Chair Cover", "Keeps your massage chair dust-free.", 5900),
];

/** Slug → accessory list. Vehicle/wellness/fitness families grouped. */
const BY_SLUG: Record<string, Addon[]> = {
  "peloton-bike-2nd-gen": BIKE_ACC,
  "peloton-bike-plus": BIKE_ACC,
  "peloton-bike-3rd-gen": BIKE_ACC,
  "spin-bike": BIKE_ACC,
  "indoor-bikes": BIKE_ACC,
  "assault-fitness-bike": BIKE_ACC,
  "peloton-tread": TREAD_ACC,
  "peloton-tread-plus": TREAD_ACC,
  "treadmills": TREAD_ACC,
  "nordictrack-treadmill": TREAD_ACC,
  "proform-treadmill": TREAD_ACC,
  "elliptical": TREAD_ACC,
  "rower": ROW_ACC,
  "peloton-row": ROW_ACC,
  "hydrow-pro-rowing-machine": ROW_ACC,
  "tonal": GYM_ACC,
  "home-gym": GYM_ACC,
  "functional-trainer": GYM_ACC,
  "smith-machine": GYM_ACC,
  "reformer": GYM_ACC,
  "hot-tub": HOTTUB_ACC,
  "swim-spa": HOTTUB_ACC,
  "jacuzzi": HOTTUB_ACC,
  "hot-spring": HOTTUB_ACC,
  "sauna": SAUNA_ACC,
  "infrared-sauna": SAUNA_ACC,
  "cold-plunge": PLUNGE_ACC,
  "float-pod": PLUNGE_ACC,
  "massage-chair": MASSAGE_ACC,
  "golf-carts": GOLF_ACC,
  "atv": GOLF_ACC,
  "rv-motorhome": GOLF_ACC,
};

const GENERIC_ACC: Addon[] = [
  A("acc-floor-protection", "Floor Protection", "Protective pads and mats installed on delivery.", 3900),
  A("acc-priority-setup", "Priority Setup", "Front-of-line white-glove assembly and placement.", 5900),
];

/**
 * Return the add-ons to offer for a set of cart category slugs: every warranty
 * tier, plus the union of accessories for those categories (deduped by key).
 * Falls back to a generic accessory set when nothing matches. Never throws.
 */
export function addonsForCategories(slugs: Array<string | null | undefined>): Addon[] {
  try {
    const seen = new Set<string>();
    const accessories: Addon[] = [];
    let matched = false;
    for (const slug of slugs) {
      const list = slug ? BY_SLUG[slug] : undefined;
      if (!list) continue;
      matched = true;
      for (const a of list) {
        if (!seen.has(a.key)) { seen.add(a.key); accessories.push(a); }
      }
    }
    if (!matched) accessories.push(...GENERIC_ACC);
    return [...WARRANTIES, ...accessories];
  } catch {
    return [...WARRANTIES];
  }
}

/** Deterministic non-colliding negative id for a synthetic add-on listing. */
function addonId(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (Math.imul(h, 31) + key.charCodeAt(i)) | 0;
  return -Math.abs(h) - 1000; // negative → never collides with real product ids
}

/** Wrap an add-on as a minimal Listing so it drops into the existing cart. */
export function addonToListing(a: Addon): Listing {
  return {
    id: addonId(a.key),
    slug: a.key,
    title: a.title,
    priceCents: a.priceCents,
    retailCents: null,
    savingsPct: null,
    categoryName: a.kind === "warranty" ? "Protection Plan" : "Add-on",
    categorySlug: "addon",
    location: null,
    condition: null,
    images: [],
    description: [a.blurb],
    sku: a.key,
    dimensions: null,
    weight: null,
    rating: 0,
    reviewCount: 0,
    permalink: "",
  };
}

/** True when a cart line is one of our synthetic add-ons (to exclude from triggers). */
export function isAddonListing(l: { categorySlug?: string | null }): boolean {
  return l?.categorySlug === "addon";
}
