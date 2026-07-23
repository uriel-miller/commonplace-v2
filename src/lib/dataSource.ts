// Data source seam. Reads listings from Postgres (via Prisma) when a database is
// configured AND the listing table is non-empty; otherwise falls back to the live
// WooCommerce source (src/lib/wc.ts). Everything is normalized to the shared
// `Listing` type so the API route and UI never learn which backend served them.
//
// Every DB path is wrapped so any connection/query error degrades gracefully to
// WooCommerce rather than surfacing an error to the caller. Server-only.

import { prisma, hasDatabaseUrl } from "./db";
import { Prisma } from "@/generated/prisma/client";
import { listProducts, type ListParams } from "./wc";
import type { Listing, ListingPage } from "./listing";

export interface SourceListParams {
  page?: number;
  perPage?: number;
  search?: string;
  /** Category slug. */
  category?: string;
  /** "recommended" | "date" | "price" | "price-desc" | "rating" | "popularity" */
  orderby?: string;
  /** Viewer city/area, e.g. "Austin, TX" — filters by parsed listing location. */
  city?: string;
}

/* ------------------------------- row mapping ------------------------------- */

function toStringArray(value: Prisma.JsonValue | null | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function rowToListing(r: Prisma.ListingModel): Listing {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    priceCents: r.priceCents,
    retailCents: r.retailCents,
    savingsPct: r.savingsPct,
    categoryName: r.categoryName,
    categorySlug: r.categorySlug,
    location: r.location,
    condition: r.condition,
    images: toStringArray(r.images),
    description: toStringArray(r.description),
    sku: r.sku,
    dimensions: r.dimensions,
    weight: r.weight,
    rating: r.rating,
    reviewCount: r.reviewCount,
    permalink: r.permalink,
  };
}

/* --------------------------- availability probe ---------------------------- */

let dbReady: boolean | null = null;
let probedAt = 0;
const PROBE_TTL_MS = 30_000;

/** True only when a client exists and the listing table currently has rows. */
async function databaseUsable(): Promise<boolean> {
  if (!prisma || !hasDatabaseUrl()) return false;
  const now = Date.now();
  if (dbReady !== null && now - probedAt < PROBE_TTL_MS) return dbReady;
  try {
    const count = await prisma.listing.count();
    dbReady = count > 0;
  } catch (err) {
    console.warn("[dataSource] DB probe failed; falling back to WooCommerce.", err);
    dbReady = false;
  }
  probedAt = now;
  return dbReady;
}

/* ------------------------------- order-by map ------------------------------ */

function wcOrderby(orderby?: string): ListParams["orderby"] {
  switch (orderby) {
    case "date":
    case "price":
    case "price-desc":
    case "rating":
    case "popularity":
    case "recommended":
      return orderby;
    default:
      return "recommended";
  }
}

function dbOrderBy(
  orderby?: string,
): Prisma.ListingOrderByWithRelationInput | Prisma.ListingOrderByWithRelationInput[] {
  switch (orderby) {
    case "price":
      return { priceCents: "asc" };
    case "price-desc":
      return { priceCents: "desc" };
    case "rating":
      return [{ rating: "desc" }, { reviewCount: "desc" }, { id: "desc" }];
    case "date":
      return [{ updatedAt: "desc" }, { id: "desc" }];
    // "recommended" / "popularity" / default: social proof, then recency.
    default:
      return [{ reviewCount: "desc" }, { rating: "desc" }, { id: "desc" }];
  }
}

/* --------------------------------- reads ----------------------------------- */

/** Paginated listing feed. DB when available, else WooCommerce. Never throws. */
export async function listFromSource(params: SourceListParams): Promise<ListingPage> {
  const page = Math.max(1, params.page ?? 1);
  const perPage = Math.min(48, Math.max(1, params.perPage ?? 24));

  if (await databaseUsable()) {
    const client = prisma as NonNullable<typeof prisma>;
    const where: Prisma.ListingWhereInput = {};
    if (params.search) where.title = { contains: params.search, mode: "insensitive" };
    if (params.category) where.categorySlug = params.category;
    if (params.city) where.location = { contains: params.city, mode: "insensitive" };
    try {
      const [rows, total] = await Promise.all([
        client.listing.findMany({
          where,
          orderBy: dbOrderBy(params.orderby),
          skip: (page - 1) * perPage,
          take: perPage,
        }),
        client.listing.count({ where }),
      ]);
      return {
        items: rows.map(rowToListing),
        total,
        totalPages: Math.max(1, Math.ceil(total / perPage)),
        page,
      };
    } catch (err) {
      console.warn("[dataSource] DB query failed; falling back to WooCommerce.", err);
    }
  }

  // Fallback: live WooCommerce. (city is handled by WC-side ranking, not filtered here.)
  return listProducts({
    page,
    perPage,
    search: params.search,
    categorySlug: params.category,
    orderby: wcOrderby(params.orderby),
  });
}

/** Single listing by slug. DB when available, else best-effort WooCommerce lookup. */
export async function getBySlug(slug: string): Promise<Listing | null> {
  if (!slug) return null;

  if (await databaseUsable()) {
    const client = prisma as NonNullable<typeof prisma>;
    try {
      const row = await client.listing.findUnique({ where: { slug } });
      return row ? rowToListing(row) : null;
    } catch (err) {
      console.warn("[dataSource] DB getBySlug failed; falling back to WooCommerce.", err);
    }
  }

  // Fallback: WooCommerce has no slug endpoint here, so search by the slug's words
  // and match exactly. Best-effort — the DB path is the real one.
  const terms = slug.replace(/-/g, " ").trim();
  const pageData = await listProducts({ search: terms, perPage: 48 });
  return pageData.items.find((it) => it.slug === slug) ?? null;
}
