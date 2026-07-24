// Catch-all backlink / SEO route. Old WordPress URLs (/product/{slug},
// /product-category/{slug}, /about-us, category slugs, /track, …) all resolve
// here and deep-link into the single-page marketplace app instead of 404-ing.
// More specific routes (/, /admin, /api/*) take precedence over this catch-all.

import type { Metadata } from "next";
import { CartProvider } from "@/components/cart/CartProvider";
import { MarketplaceApp, type InitialRoute } from "@/components/marketplace/MarketplaceApp";
import { resolveInfoPage } from "@/components/pages/info";
import { findCategoryBySlug } from "@/components/marketplace/data";
import { fuzzyCategoryMatch } from "@/lib/fuzzy";
import { getBySlug } from "@/lib/dataSource";
import type { Listing } from "@/lib/listing";

export const dynamic = "force-dynamic";

const clean = (s: string) => decodeURIComponent(s || "").trim().toLowerCase().replace(/^\/+|\/+$/g, "");

/**
 * Resolve a bare slug (e.g. "golf-cart", "lg-wt7600hka-washer") to a buy view.
 * Tries an exact category slug, then a fuzzy category match on the spaced words,
 * then a specific listing by slug. Powers the thousands of Google-indexed
 * "sell-a-used-X" / "buy-X" landing pages without generating a file per page.
 */
async function resolveTailToBuy(tail: string): Promise<InitialRoute | null> {
  const t = clean(tail);
  if (!t) return null;
  const cat = findCategoryBySlug(t);
  if (cat) return { view: "category", category: cat };
  const fuzzy = fuzzyCategoryMatch(t.replace(/-/g, " "));
  if (fuzzy) return { view: "category", category: fuzzy.cat };
  try {
    const product = await getBySlug(t);
    if (product) return { view: "product", product };
  } catch { /* ignore */ }
  return null;
}

/** Resolve a URL path (segments) to an initial app route. Never throws. */
async function resolveRoute(segments: string[]): Promise<InitialRoute> {
  const parts = (segments ?? []).map(clean).filter(Boolean);
  if (parts.length === 0) return { view: "browse" };
  const [a, b] = parts;

  // Google-indexed SEO landing pages: /sell-a-used-{thing} and /buy-{thing}
  // (also "shop-", "used-", "for-sale") → resolve {thing} to a buy page so the
  // sell pages each have a matching, discoverable-from-search buy page.
  const seo = a.match(/^(?:sell-(?:a-|an-)?(?:used-)?|buy-(?:a-|an-)?(?:used-)?|shop-(?:for-)?(?:used-)?|used-|(.+)-for-sale)(.+)?$/);
  if (seo) {
    const tail = (a.endsWith("-for-sale") ? seo[1] : seo[2]) ?? "";
    const buy = await resolveTailToBuy(tail);
    if (buy) return buy;
  }

  // /product/{slug} → product page (fetch the listing by slug)
  if (a === "product" && b) {
    try {
      const product = await getBySlug(b);
      if (product) return { view: "product", product };
    } catch { /* fall through to browse */ }
    return { view: "browse" };
  }

  // /product-category/{slug} or /category/{slug} → category page
  if ((a === "product-category" || a === "category") && b) {
    const cat = findCategoryBySlug(b);
    if (cat) return { view: "category", category: cat };
    return { view: "browse" };
  }

  // Blog / articles
  if (a === "blog" || a === "articles" || a === "guides") return { view: "blog", blogSlug: b };

  // Standalone app views
  if (a === "track") return { view: "track" };
  if (a === "sell" || a === "sell-an-item" || a === "sell-item") return { view: "sell" };
  if (a === "cart") return { view: "cart" };
  if (a === "search") return { view: "search", query: b ?? "" };

  // Single segment: an info/marketing page, else a category, else a product slug.
  const info = resolveInfoPage(a);
  if (info) return { view: "info", infoSlug: a };
  const cat = findCategoryBySlug(a);
  if (cat) return { view: "category", category: cat };
  try {
    const product = await getBySlug(a);
    if (product) return { view: "product", product };
  } catch { /* ignore */ }

  return { view: "browse" };
}

export async function generateMetadata({ params }: { params: Promise<{ path: string[] }> }): Promise<Metadata> {
  const { path } = await params;
  const route = await resolveRoute(path).catch(() => ({ view: "browse" }) as InitialRoute);
  const base = "Commonplace";
  if (route.view === "product" && route.product) {
    const p = route.product as Listing;
    return { title: `${p.title} — ${base}`, description: (p.description?.[0] ?? `Buy ${p.title} on Commonplace — inspected, delivered, pay on delivery.`).slice(0, 160) };
  }
  if (route.view === "category" && route.category) {
    return { title: `${route.category.name} — ${base}`, description: `Shop ${route.category.name} on Commonplace. Inspected at pickup, white-glove delivery, pay after you test it at home.` };
  }
  if (route.view === "info" && route.infoSlug) {
    const entry = resolveInfoPage(route.infoSlug);
    if (entry) return { title: `${entry.title} — ${base}` };
  }
  if (route.view === "track") return { title: `Track your order — ${base}` };
  if (route.view === "sell") return { title: `Sell on Commonplace — ${base}` };
  return { title: base };
}

export default async function CatchAllPage({ params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const initialRoute = await resolveRoute(path).catch(() => ({ view: "browse" }) as InitialRoute);
  return (
    <CartProvider>
      <MarketplaceApp initialRoute={initialRoute} />
    </CartProvider>
  );
}
