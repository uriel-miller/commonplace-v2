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
