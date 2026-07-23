import { getOrder } from "@/lib/orders";

export const dynamic = "force-dynamic";

/** GET /api/orders/[id] — one order with its event timeline. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  let id = "";
  try {
    id = (await ctx.params).id;
  } catch {
    /* fall through to bad-input */
  }
  if (!id || typeof id !== "string") {
    return Response.json({ order: null, error: "Missing order id." }, { status: 400 });
  }
  try {
    const order = await getOrder(id);
    if (!order) {
      return Response.json({ order: null, error: "Order not found." }, { status: 404 });
    }
    return Response.json({ order });
  } catch (err) {
    console.warn("[api/orders/[id]] failed", err);
    return Response.json({ order: null, error: String(err) }, { status: 200 });
  }
}
