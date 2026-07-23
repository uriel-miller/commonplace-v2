// Shared, framework-agnostic listing type + helpers. Safe to import from both
// server (data layer) and client (UI). No server-only dependencies here.

export interface Listing {
  id: number;
  slug: string;
  title: string;
  priceCents: number;
  /** Original/retail price when on sale, else null. */
  retailCents: number | null;
  savingsPct: number | null;
  categoryName: string;
  categorySlug: string;
  /** Parsed "City, ST" when present in the title. */
  location: string | null;
  condition: string | null;
  images: string[];
  /** Plain-text description paragraphs. */
  description: string[];
  sku: string;
  dimensions: string | null;
  weight: string | null;
  rating: number;
  reviewCount: number;
  permalink: string;
}

export interface ListingPage {
  items: Listing[];
  total: number;
  totalPages: number;
  page: number;
}

export function formatPrice(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

// Shipping radius rules: vehicles ship anywhere (no limit); everything else
// ships up to 1,500 miles. Delivery is free within 100 miles either way.
const VEHICLE_SLUGS = new Set([
  "cars", "golf-carts", "golf-cart-tires", "atv", "rv-motorhome", "camper-vans",
  "motorcycles", "boats", "mini-moke", "e-bike", "electric-scooter",
]);

export function isVehicleCategory(slug: string | null | undefined): boolean {
  return !!slug && VEHICLE_SLUGS.has(slug);
}

export interface ShippingInfo {
  freeMi: number;
  maxMi: number | null; // null = no limit
  label: string;
}

export function shippingInfo(categorySlug: string | null | undefined): ShippingInfo {
  if (isVehicleCategory(categorySlug)) {
    return { freeMi: 100, maxMi: null, label: "Ships anywhere — no distance limit" };
  }
  return { freeMi: 100, maxMi: 1500, label: "Ships up to 1,500 miles · free within 100" };
}
