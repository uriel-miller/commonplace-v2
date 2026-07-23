// Server-side WooCommerce Store API client + normalization.
// This is the single seam between the new app and live inventory: the UI talks
// only to our own /api routes, which call this. When we migrate to Postgres,
// only this file changes — the UI and API contract stay put.

import type { Listing, ListingPage } from "./listing";

const WC_BASE = "https://trycommonplace.com/wp-json/wc/store/v1";
const REVALIDATE = 300; // seconds

/* --------------------------------- helpers --------------------------------- */

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  hellip: "…", mdash: "—", ndash: "–", rsquo: "’", lsquo: "‘",
  ldquo: "“", rdquo: "”", deg: "°", frac12: "½", frac14: "¼", frac34: "¾",
};

export function decodeEntities(input: string): string {
  if (!input) return "";
  let s = input;
  // Decode twice to handle double-encoding (&amp;#8211;).
  for (let i = 0; i < 2; i++) {
    s = s
      .replace(/&#x([0-9a-f]+);/gi, (_m, h) => safeCodePoint(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_m, n) => safeCodePoint(parseInt(n, 10)))
      .replace(/&([a-z0-9]+);/gi, (m, name) => NAMED[name.toLowerCase()] ?? m);
  }
  return s;
}

function safeCodePoint(cp: number): string {
  try {
    return String.fromCodePoint(cp);
  } catch {
    return "";
  }
}

function stripTags(html: string): string[] {
  const withBreaks = html
    .replace(/<\/(p|div|li)>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ");
  const text = decodeEntities(withBreaks.replace(/<[^>]+>/g, ""));
  return text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function parseLocation(title: string): string | null {
  const m = title.match(/[–—-]\s*([A-Za-z][A-Za-z .'-]+,\s*[A-Z]{2})\s*$/);
  return m ? m[1].trim() : null;
}

const CONDITION_RX = /\b(brand new|open box|like new|refurbished|excellent|very good|good|fair|new|used)\b/i;
function parseCondition(title: string, tags: string[]): string | null {
  const fromTag = tags.map((t) => t.toLowerCase()).find((t) => CONDITION_RX.test(t));
  const src = fromTag ?? title;
  const m = src.match(CONDITION_RX);
  if (!m) return null;
  const c = m[1].toLowerCase();
  return c.charAt(0).toUpperCase() + c.slice(1);
}

/* WC Store API raw product shape (only the fields we use). */
interface WcPrices { price?: string; regular_price?: string; sale_price?: string }
interface WcProduct {
  id: number; name: string; slug: string; permalink: string; sku: string;
  short_description: string; description: string; on_sale: boolean;
  prices: WcPrices; average_rating: string; review_count: number;
  images: { src: string }[]; categories: { name: string; slug: string }[];
  tags: { name: string }[]; formatted_dimensions: string; formatted_weight: string;
  is_in_stock: boolean;
}

function normalize(p: WcProduct): Listing {
  const title = decodeEntities(p.name);
  const priceCents = parseInt(p.prices?.price ?? "0", 10) || 0;
  const regular = parseInt(p.prices?.regular_price ?? "0", 10) || 0;
  const retailCents = p.on_sale && regular > priceCents ? regular : null;
  const savingsPct = retailCents ? Math.round((1 - priceCents / retailCents) * 100) : null;
  const dims = p.formatted_dimensions && p.formatted_dimensions !== "N/A" ? p.formatted_dimensions : null;
  const weight = p.formatted_weight && p.formatted_weight !== "N/A" ? p.formatted_weight : null;
  return {
    id: p.id,
    slug: p.slug,
    title,
    priceCents,
    retailCents,
    savingsPct,
    categoryName: p.categories?.[0]?.name ?? "Marketplace",
    categorySlug: p.categories?.[0]?.slug ?? "",
    location: parseLocation(title),
    condition: parseCondition(title, (p.tags ?? []).map((t) => t.name)),
    images: (p.images ?? []).map((i) => i.src).filter(Boolean),
    description: stripTags(p.description || p.short_description || ""),
    sku: p.sku ?? "",
    dimensions: dims,
    weight,
    rating: parseFloat(p.average_rating || "0") || 0,
    reviewCount: p.review_count ?? 0,
    permalink: p.permalink,
  };
}

async function wcFetch(path: string): Promise<{ json: unknown; total: number; totalPages: number }> {
  const res = await fetch(`${WC_BASE}${path}`, {
    next: { revalidate: REVALIDATE },
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`WC ${res.status} for ${path}`);
  const total = parseInt(res.headers.get("x-wp-total") ?? "0", 10) || 0;
  const totalPages = parseInt(res.headers.get("x-wp-totalpages") ?? "0", 10) || 0;
  return { json: await res.json(), total, totalPages };
}

/* Full slug → category id map. The Store API's ?slug= filter is IGNORED (it
   returns every category), so we must page the whole taxonomy and match exactly.
   Cached in-module; also protected by fetch-level revalidation. */
let CATEGORY_MAP: Map<string, number> | null = null;
async function loadCategoryMap(): Promise<Map<string, number>> {
  if (CATEGORY_MAP && CATEGORY_MAP.size > 0) return CATEGORY_MAP;
  const map = new Map<string, number>();
  for (let page = 1; page <= 8; page++) {
    const { json, totalPages } = await wcFetch(`/products/categories?per_page=100&page=${page}`);
    const arr = json as { id: number; slug: string }[];
    if (!Array.isArray(arr) || arr.length === 0) break;
    for (const c of arr) if (c.slug) map.set(c.slug, c.id);
    if (totalPages && page >= totalPages) break;
  }
  if (map.size > 0) CATEGORY_MAP = map;
  return map;
}

export async function getCategoryId(slug: string): Promise<number | null> {
  if (!slug) return null;
  try {
    const map = await loadCategoryMap();
    return map.get(slug) ?? null;
  } catch {
    return null;
  }
}

// Utility/service SKUs that live in the catalog but aren't sellable listings.
const JUNK_RX = /\b(warranty|check[-\s]?in|pre[-\s]?pickup|deposit|reservation|add[-\s]?on|balance|remainder|test\s?drive|handling fee|shipping fee|placeholder|sample product)\b/i;
function isRealListing(l: Listing): boolean {
  if (l.categorySlug === "addons" || l.categoryName.toLowerCase() === "addons") return false;
  if (JUNK_RX.test(l.title)) return false;
  if (l.priceCents < 1000) return false; // < $10 → not a real big-ticket item
  return true;
}

export interface ListParams {
  page?: number;
  perPage?: number;
  search?: string;
  categorySlug?: string;
  orderby?: "recommended" | "date" | "price" | "price-desc" | "rating" | "popularity";
}

export async function listProducts(params: ListParams): Promise<ListingPage> {
  const page = Math.max(1, params.page ?? 1);
  const perPage = Math.min(48, Math.max(1, params.perPage ?? 24));
  // Over-fetch so post-filtering junk SKUs still fills the grid.
  const fetchPerPage = Math.min(100, perPage + 20);
  const q = new URLSearchParams();
  q.set("page", String(page));
  q.set("per_page", String(fetchPerPage));
  if (params.search) q.set("search", params.search);
  if (params.categorySlug) {
    const id = await getCategoryId(params.categorySlug);
    // Unresolved category → return empty rather than the whole catalog.
    if (!id) return { items: [], total: 0, totalPages: 0, page };
    q.set("category", String(id));
  }
  // Map our sort → Store API. "recommended" fetches by popularity then we re-rank.
  switch (params.orderby) {
    case "price": q.set("orderby", "price"); q.set("order", "asc"); break;
    case "price-desc": q.set("orderby", "price"); q.set("order", "desc"); break;
    case "rating": q.set("orderby", "rating"); q.set("order", "desc"); break;
    case "date": q.set("orderby", "date"); q.set("order", "desc"); break;
    default: q.set("orderby", "popularity"); q.set("order", "desc"); break;
  }
  const { json, total, totalPages } = await wcFetch(`/products?${q.toString()}`);
  const items = (json as WcProduct[]).map(normalize).filter(isRealListing).slice(0, perPage);
  return { items, total, totalPages, page };
}
