import type { NextRequest } from "next/server";
import { listFromSource } from "@/lib/dataSource";
import { rankListings } from "@/lib/ranking";

export const revalidate = 300;

const SORTS = ["recommended", "date", "price", "price-desc", "rating", "popularity"];

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const orderbyRaw = sp.get("orderby") ?? "recommended";
  const orderby = SORTS.includes(orderbyRaw) ? orderbyRaw : "recommended";
  const page = parseInt(sp.get("page") ?? "1", 10) || 1;
  const perPage = parseInt(sp.get("per_page") ?? "24", 10) || 24;
  const search = sp.get("search") ?? undefined;
  const category = sp.get("category") ?? undefined;
  const city = sp.get("city") ?? undefined;

  try {
    // Reads from our Postgres when populated, else falls back to live inventory.
    const data = await listFromSource({ page, perPage, search, category, orderby, city });
    const items =
      orderby === "recommended" ? rankListings(data.items, { query: search, city }) : data.items;
    return Response.json({ ...data, items });
  } catch (err) {
    // Fail soft so the UI shows an empty state instead of crashing.
    return Response.json(
      { items: [], total: 0, totalPages: 0, page, error: String(err) },
      { status: 200 },
    );
  }
}
