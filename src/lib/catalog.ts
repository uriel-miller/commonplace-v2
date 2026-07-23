import type { Category, Product } from "./types";

// The real "popular families" surfaced from the live catalog analysis
// (392 WooCommerce terms collapse to ~14 true families). Counts are
// representative until we're wired to Postgres.
export const CATEGORIES: Category[] = [
  { slug: "golf-carts", name: "Golf Carts", popular: true, count: 1574, tint: "green" },
  { slug: "treadmills", name: "Treadmills", popular: true, count: 323, tint: "maroon" },
  { slug: "ellipticals", name: "Ellipticals", popular: true, count: 255, tint: "blue" },
  { slug: "peloton", name: "Peloton", popular: true, count: 1002, tint: "red" },
  { slug: "hot-tubs", name: "Hot Tubs", popular: true, count: 197, tint: "blue-ink" },
  { slug: "tonal", name: "Tonal", popular: true, count: 165, tint: "ink" },
  { slug: "saunas", name: "Saunas", popular: true, count: 110, tint: "gold" },
  { slug: "cold-plunges", name: "Cold Plunges", popular: true, count: 44, tint: "blue" },
  { slug: "home-gyms", name: "Home Gyms", popular: true, count: 138, tint: "purple" },
  { slug: "furniture", name: "Furniture", popular: true, count: 420, tint: "gold" },
  { slug: "appliances", name: "Appliances", popular: true, count: 205, tint: "green" },
  { slug: "pianos", name: "Pianos", popular: true, count: 61, tint: "maroon2" },
  { slug: "pool-tables", name: "Pool Tables", popular: true, count: 73, tint: "green" },
  { slug: "vehicles", name: "Vehicles", popular: true, count: 96, tint: "blue-ink" },
];

export function getCategory(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

// Representative "Today's picks" inventory. Deterministic (no randomness) so
// server and client render identically.
export const PRODUCTS: Product[] = [
  { id: "p1", slug: "nordictrack-commercial-1750", title: "NordicTrack Commercial 1750 Treadmill", categorySlug: "treadmills", priceCents: 89900, condition: "excellent", location: "Austin, TX", distanceMi: 6, tint: "maroon" },
  { id: "p2", slug: "peloton-bike-plus", title: "Peloton Bike+ with Shoes & Weights", categorySlug: "peloton", priceCents: 129500, condition: "like-new", location: "Round Rock, TX", distanceMi: 14, tint: "red" },
  { id: "p3", slug: "master-spas-twilight", title: "Master Spas Twilight Series Hot Tub (6-person)", categorySlug: "hot-tubs", priceCents: 449900, condition: "good", location: "Cedar Park, TX", distanceMi: 18, tint: "blue-ink" },
  { id: "p4", slug: "tonal-smart-home-gym", title: "Tonal Smart Home Gym + Smart Accessories", categorySlug: "tonal", priceCents: 210000, condition: "excellent", location: "Austin, TX", distanceMi: 4, tint: "ink" },
  { id: "p5", slug: "sole-e95-elliptical", title: "Sole E95 Elliptical Trainer", categorySlug: "ellipticals", priceCents: 74900, condition: "good", location: "Pflugerville, TX", distanceMi: 11, tint: "blue" },
  { id: "p6", slug: "club-car-onward-4", title: "Club Car Onward 4-Passenger Golf Cart", categorySlug: "golf-carts", priceCents: 799900, condition: "like-new", location: "Georgetown, TX", distanceMi: 22, tint: "green" },
  { id: "p7", slug: "sun-home-luminar-sauna", title: "Sun Home Luminar 2-Person Infrared Sauna", categorySlug: "saunas", priceCents: 389900, condition: "new", location: "Austin, TX", distanceMi: 8, tint: "gold" },
  { id: "p8", slug: "plunge-cold-tub", title: "The Plunge — All-In Cold Plunge Tub", categorySlug: "cold-plunges", priceCents: 549900, condition: "excellent", location: "Lakeway, TX", distanceMi: 19, tint: "blue" },
  { id: "p9", slug: "bowflex-revolution", title: "Bowflex Revolution Home Gym", categorySlug: "home-gyms", priceCents: 119900, condition: "good", location: "Kyle, TX", distanceMi: 24, tint: "purple" },
  { id: "p10", slug: "west-elm-harmony-sofa", title: "West Elm Harmony 3-Seat Sofa", categorySlug: "furniture", priceCents: 89900, condition: "like-new", location: "Austin, TX", distanceMi: 3, tint: "gold" },
  { id: "p11", slug: "sub-zero-refrigerator", title: "Sub-Zero 36\" Built-In Refrigerator", categorySlug: "appliances", priceCents: 349900, condition: "good", location: "West Lake Hills, TX", distanceMi: 9, tint: "green" },
  { id: "p12", slug: "yamaha-u1-upright-piano", title: "Yamaha U1 Upright Piano", categorySlug: "pianos", priceCents: 379900, condition: "excellent", location: "Austin, TX", distanceMi: 7, tint: "maroon2" },
];

export function productsByCategory(slug: string): Product[] {
  return PRODUCTS.filter((p) => p.categorySlug === slug);
}
