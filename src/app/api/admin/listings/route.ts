/**
 * GET /api/admin/listings?search=&category=&page=
 *
 * Admin-only, paginated listing feed for the operator's management table.
 * Reads via `listFromSource` (Prisma when a DATABASE_URL is configured, else the
 * live WooCommerce source) so it degrades gracefully and NEVER throws to the
 * client. Guarded by the shared `isAdmin` gate — non-admins get a 401.
 *
 * Response (always 200 on success):
 *   { ok: true, items: Listing[], total, totalPages, page, perPage, warning? }
 */

import type { NextRequest } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { listFromSource } from "@/lib/dataSource";
import type { Listing } from "@/lib/listing";

export const dynamic = "force-dynamic";

const PER_PAGE = 25;

interface ListResponse {
  ok: boolean;
  items: Listing[];
  total: number;
  totalPages: number;
  page: number;
  perPage: number;
  warning?: string;
  error?: string;
}

/** Parse a 1-based page number from a query param; defaults to 1. */
function parsePage(v: string | null): number {
  const n = Number(v);
  if (Number.isFinite(n) && n >= 1) return Math.floor(n);
  return 1;
}

function clean(v: string | null): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function GET(req: NextRequest): Promise<Response> {
  // Auth gate — fail closed.
  try {
    if (!isAdmin(req)) {
      return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  } catch {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const search = clean(url.searchParams.get("search"));
    const category = clean(url.searchParams.get("category"));
    const page = parsePage(url.searchParams.get("page"));

    const result = await listFromSource({
      page,
      perPage: PER_PAGE,
      search: search || undefined,
      category: category || undefined,
      orderby: "date",
    });

    const body: ListResponse = {
      ok: true,
      items: result.items,
      total: result.total,
      totalPages: result.totalPages,
      page: result.page,
      perPage: PER_PAGE,
    };
    return Response.json(body, { status: 200 });
  } catch (err) {
    // Fail soft: never surface a 500 to the admin UI — return an empty page.
    const body: ListResponse = {
      ok: false,
      items: [],
      total: 0,
      totalPages: 1,
      page: 1,
      perPage: PER_PAGE,
      warning: `Could not load listings: ${err instanceof Error ? err.message : String(err)}`,
    };
    return Response.json(body, { status: 200 });
  }
}
