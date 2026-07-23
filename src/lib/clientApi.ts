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

// Tier-3 fallback: remember the last successful response per exact query so a
// transient network/API failure degrades to stale-but-real data, not a blank.
const lastGood = new Map<string, ListingPage>();

function buildUrl(p: FetchListingParams): string {
  const q = new URLSearchParams();
  if (p.page) q.set("page", String(p.page));
  if (p.perPage) q.set("per_page", String(p.perPage));
  if (p.search) q.set("search", p.search);
  if (p.category) q.set("category", p.category);
  if (p.orderby) q.set("orderby", p.orderby);
  if (p.city) q.set("city", p.city);
  return `/api/products?${q.toString()}`;
}

async function fetchWithTimeout(url: string, ms = 12000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resilient listings fetch with layered fallbacks (site runs at scale):
 *   Tier 1 — fetch our API (which itself falls back Postgres → WooCommerce).
 *   Tier 2 — up to 3 attempts with backoff + per-request timeout.
 *   Tier 3 — last-good cached response for this exact query, else a safe empty.
 * Never throws.
 */
export async function fetchListings(p: FetchListingParams): Promise<ListingPage> {
  const url = buildUrl(p);
  const key = url;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetchWithTimeout(url);
      if (res.ok) {
        const data = (await res.json()) as ListingPage;
        if (data && Array.isArray(data.items)) {
          lastGood.set(key, data);
          return data;
        }
      }
    } catch {
      // swallow and retry
    }
    if (attempt < 2) await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
  }

  return lastGood.get(key) ?? EMPTY;
}
