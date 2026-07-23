import type { NextRequest } from "next/server";
import { listOrders } from "@/lib/orders";

export const dynamic = "force-dynamic";

/** GET /api/orders — all orders, newest first. Fails soft to []. */
export async function GET(req: NextRequest) {
  const limitRaw = parseInt(req.nextUrl.searchParams.get("limit") ?? "100", 10);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 100;
  try {
    const orders = await listOrders(limit);
    return Response.json({ orders });
  } catch (err) {
    console.warn("[api/orders] failed", err);
    return Response.json({ orders: [], error: String(err) }, { status: 200 });
  }
}
