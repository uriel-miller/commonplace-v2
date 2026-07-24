// Category-specific cart add-ons for the in-cart upsell pop-up. These are the
// REAL Commonplace add-on products (titles + prices pulled from the live
// WooCommerce catalog): the universal $39 Pre-Pickup Check-In, per-model
// 12-month warranties, the Expert Hot Tub Inspection, and real accessories.
//
// Framework-agnostic and dependency-free. Every export is fail-soft: bad input
// degrades to a sensible generic set or an empty list, never a throw.

import type { Listing } from "./listing";

export type AddonKind = "service" | "warranty" | "accessory";

export interface Addon {
  key: string;
  title: string;
  blurb: string;
  priceCents: number;
  kind: AddonKind;
  /** Real product photo (accessories + services). Warranty/pre-pickup use an icon. */
  image?: string;
}

/** Live-site upload base for real add-on product photos. */
const IMG = "https://trycommonplace.com/wp-content/uploads/";

const A = (key: string, kind: AddonKind, title: string, blurb: string, priceCents: number, image?: string): Addon =>
  ({ key, kind, title, blurb, priceCents, image });

/* ------------------------------------------------------------------ */
/* Services (real live products)                                      */
/* ------------------------------------------------------------------ */
// Pre-Pickup keeps its icon (no photo) per spec.
const PRE_PICKUP = A("svc-pre-pickup", "service", "Pre-Pickup Check-In", "A quick pre-pickup verification of your item — so there are no surprises on delivery day.", 3900);
const HOT_TUB_INSPECTION = A("svc-hottub-inspection", "service", "Expert Hot Tub Inspection & Report", "A specialist inspects the tub and sends you a full quality report before it ships.", 19500, `${IMG}2025/08/Hot-tub-repair.jpg`);

/* ------------------------------------------------------------------ */
/* Warranties (real 12-month prices, per model)                       */
/* ------------------------------------------------------------------ */
const warranty = (key: string, title: string, priceCents: number): Addon =>
  A(key, "warranty", title, "Full parts & labor coverage for 12 months after delivery.", priceCents);

const W_BIKE = warranty("war-peloton-bike", "Peloton Bike 12-Month Warranty", 13900);
const W_BIKE_PLUS = warranty("war-peloton-bike-plus", "Peloton Bike+ 12-Month Warranty", 21900);
const W_TREAD = warranty("war-peloton-tread", "Peloton Tread 12-Month Warranty", 26000);
const W_TREAD_PLUS = warranty("war-peloton-tread-plus", "Peloton Tread+ 12-Month Warranty", 69900);
const W_ROW = warranty("war-peloton-row", "Peloton Row 12-Month Warranty", 52000);
const W_HYDROW = warranty("war-hydrow", "Hydrow Pro 12-Month Warranty", 18000);
const W_GENERIC = warranty("war-generic", "12-Month Protection Plan", 14900);

/* ------------------------------------------------------------------ */
/* Accessories (real live products)                                   */
/* ------------------------------------------------------------------ */
const acc = (key: string, title: string, blurb: string, priceCents: number, image: string): Addon => A(key, "accessory", title, blurb, priceCents, image);

const SHOES = acc("acc-peloton-shoes", "Peloton Bike Shoes", "Clip-in cycling shoes sized to your fit, delivered with the bike.", 7900, `${IMG}2025/10/Trademyspin_Pelotonshoes_allsizes-1.webp`);
const SEAT = acc("acc-peloton-seat", "Cushioned Seat", "A comfort seat for longer rides.", 4900, `${IMG}2025/03/Seat-cushion.jpg`);
const PHONE = acc("acc-peloton-phone", "Phone Holder", "Keep your phone in view while you ride.", 4900, `${IMG}2025/03/Phone-Holder.jpg`);
const WEIGHTS = acc("acc-peloton-weights", "Peloton Weights", "Light hand weights for on-bike strength work.", 2900, `${IMG}2025/10/Trademyspin_pelotonweights_3lb_black.webp`);
const BIKE_FAN = acc("acc-bike-fan", "Bike Fan", "Stay cool through every ride.", 3900, `${IMG}2025/10/Trademyspin_pelotonbike_fan_front.webp`);
const MAT = acc("acc-exercise-mat", "Exercise Mat", "Protects your floor and steadies the frame.", 4900, `${IMG}2025/10/shopping.webp`);
const SWIVEL = acc("acc-swivel-kit", "Bike Swivel Kit", "Rotate the bike to follow floor workouts (Bike gens 1-3).", 6900, `${IMG}2025/10/Trademyspin_Pelotonbikeswivelkit_bikeaccessory.webp`);
const DUMBBELLS = acc("acc-dumbbells", "Adjustable Dumbbell Set", "Space-saving adjustable hand weights.", 7999, `${IMG}2025/10/51S9YAp9IIL._AC_SL1000.webp`);
const TREAD_KEY = acc("acc-tread-key", "Tread Safety Key", "A spare magnetic safety key.", 4800, `${IMG}2025/10/Trade_My_Spin_treadsafetykey.webp`);
const WALK_DESK = acc("acc-walk-desk", "Walking Desk Attachment", "Laptop, tablet & phone holder for the Tread+.", 19900, `${IMG}2025/03/treadtray1.jpg`);
const ROW_FAN = acc("acc-row-fan", "Row Fan", "Airflow for longer rows.", 7999, `${IMG}2025/04/71GBR3UXvL._AC_SX679_.jpg`);

const BIKE_ACC = [SHOES, SEAT, PHONE, WEIGHTS, BIKE_FAN, MAT, SWIVEL, DUMBBELLS];

/* ------------------------------------------------------------------ */
/* Category resolution (keyword rules over slug + name, order matters) */
/* ------------------------------------------------------------------ */
interface Bundle { warranty: Addon; accessories: Addon[]; services?: Addon[] }

const RULES: Array<[RegExp, Bundle]> = [
  [/peloton[^]*tread[^]*(\+|plus)|tread[^]*(\+|plus)[^]*peloton/i, { warranty: W_TREAD_PLUS, accessories: [WALK_DESK, TREAD_KEY, MAT] }],
  [/peloton[^]*tread|tread[^]*peloton/i, { warranty: W_TREAD, accessories: [TREAD_KEY, MAT] }],
  [/peloton[^]*row|row[^]*peloton/i, { warranty: W_ROW, accessories: [ROW_FAN, MAT] }],
  [/hydrow/i, { warranty: W_HYDROW, accessories: [ROW_FAN, MAT] }],
  [/(peloton[^]*(bike ?\+|bike ?plus)|bike ?\+|bike ?plus)/i, { warranty: W_BIKE_PLUS, accessories: BIKE_ACC }],
  [/peloton[^]*bike|\bpeloton\b|spin ?bike|indoor ?(cycling )?bike/i, { warranty: W_BIKE, accessories: BIKE_ACC }],
  [/tread ?mill|nordic ?track|pro ?form/i, { warranty: W_GENERIC, accessories: [TREAD_KEY, MAT] }],
  [/rower|rowing/i, { warranty: W_GENERIC, accessories: [ROW_FAN, MAT] }],
  [/hot ?tub|jacuzzi|hot ?spring|swim ?spa|\bspa\b|sauna|cold ?plunge|plunge|float ?pod/i, { warranty: W_GENERIC, accessories: [], services: [HOT_TUB_INSPECTION] }],
  // Vehicles get protection only — no fitness accessories like mats.
  [/golf ?cart|\bcar\b|truck|\bsuv\b|\batv\b|scooter|vespa|motorcycle|\bvehicle|\brv\b|motorhome|dirt ?bike|jet ?ski|moped|lawn ?mower/i, { warranty: W_GENERIC, accessories: [] }],
  [/elliptical|tonal|home ?gym|functional|smith|dumbbell|weight|assault|stairmaster|bowflex/i, { warranty: W_GENERIC, accessories: [MAT, DUMBBELLS] }],
];

/**
 * Add-ons to offer for a set of cart category tokens (slug and/or name). Always
 * includes the universal Pre-Pickup Check-In service; adds each matched
 * category's warranty + accessories (+ hot-tub inspection where relevant), all
 * deduped by key. Falls back to a generic warranty + mat when nothing matches.
 * Never throws.
 */
export function addonsForCategories(tokens: Array<string | null | undefined>): Addon[] {
  try {
    const seen = new Set<string>();
    const services: Addon[] = [];
    const warranties: Addon[] = [];
    const accessories: Addon[] = [];
    const push = (list: Addon[], a: Addon) => { if (!seen.has(a.key)) { seen.add(a.key); list.push(a); } };

    push(services, PRE_PICKUP); // universal

    let matched = false;
    for (const token of tokens) {
      if (!token) continue;
      const s = String(token);
      const hit = RULES.find(([re]) => re.test(s));
      if (!hit) continue;
      matched = true;
      const b = hit[1];
      push(warranties, b.warranty);
      for (const a of b.accessories) push(accessories, a);
      for (const a of b.services ?? []) push(services, a);
    }
    if (!matched) { push(warranties, W_GENERIC); } // protection only; no category-mismatched accessories

    // Order in the pop-up: services → protection → accessories.
    return [...services, ...warranties, ...accessories];
  } catch {
    return [PRE_PICKUP, W_GENERIC];
  }
}

/* ------------------------------------------------------------------ */
/* Synthetic-listing helpers                                          */
/* ------------------------------------------------------------------ */
function addonId(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (Math.imul(h, 31) + key.charCodeAt(i)) | 0;
  return -Math.abs(h) - 1000; // negative → never collides with real product ids
}

export function addonToListing(a: Addon): Listing {
  const label = a.kind === "warranty" ? "Protection Plan" : a.kind === "service" ? "Service" : "Add-on";
  return {
    id: addonId(a.key),
    slug: a.key,
    title: a.title,
    priceCents: a.priceCents,
    retailCents: null,
    savingsPct: null,
    categoryName: label,
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

export function isAddonListing(l: { categorySlug?: string | null }): boolean {
  return l?.categorySlug === "addon";
}
