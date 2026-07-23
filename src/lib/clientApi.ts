import type { ListingPage } from "./listing";

export interface FetchListingParams {
  page?: number;
  perPage?: number;
  search?: string;
  category?: string;
  orderby?: string;
  city?: string;
}

const EMPTY: ListingPage = { items: [], total: 0, totalPages: 0, page: 1 };

/** Fetch listings from our own API (which proxies + ranks live inventory). */
export async function fetchListings(p: FetchListingParams): Promise<ListingPage> {
  const q = new URLSearchParams();
  if (p.page) q.set("page", String(p.page));
  if (p.perPage) q.set("per_page", String(p.perPage));
  if (p.search) q.set("search", p.search);
  if (p.category) q.set("category", p.category);
  if (p.orderby) q.set("orderby", p.orderby);
  if (p.city) q.set("city", p.city);
  try {
    const res = await fetch(`/api/products?${q.toString()}`);
    if (!res.ok) return EMPTY;
    return (await res.json()) as ListingPage;
  } catch {
    return EMPTY;
  }
}
