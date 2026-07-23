import type { NextRequest } from "next/server";
import {
  createOrderFromCart,
  EmptyCartError,
  type CartLineInput,
  type BuyerInput,
} from "@/lib/orders";

export const dynamic = "force-dynamic";

interface CheckoutBody {
  items?: unknown;
  buyer?: unknown;
}

/**
 * POST /api/checkout — reserve a cart for $1.
 * Body: { items: CartLineInput[], buyer?: { name?, pickupCity?, deliverCity? } }
 * Returns: { ok, orderId, dueTodayCents, balanceCents, order }.
 * Never throws to the client; bad input → 400, everything else fails soft.
 */
export async function POST(req: NextRequest) {
  let body: CheckoutBody;
  try {
    body = (await req.json()) as CheckoutBody;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const rawItems = Array.isArray(body?.items) ? (body.items as CartLineInput[]) : [];
  if (rawItems.length === 0) {
    return Response.json({ ok: false, error: "Cart is empty." }, { status: 400 });
  }

  const buyer: BuyerInput =
    body?.buyer && typeof body.buyer === "object" ? (body.buyer as BuyerInput) : {};

  try {
    const order = await createOrderFromCart(rawItems, buyer);
    return Response.json({
      ok: true,
      orderId: order.id,
      dueTodayCents: order.depositCents,
      balanceCents: order.balanceCents,
      deliveryFeeCents: order.deliveryFeeCents,
      manualWire: order.manualWire,
      order,
    });
  } catch (err) {
    if (err instanceof EmptyCartError) {
      return Response.json({ ok: false, error: "Cart is empty." }, { status: 400 });
    }
    // Unexpected — fail soft so the buyer sees a friendly retry, not a stack trace.
    console.warn("[api/checkout] failed", err);
    return Response.json(
      { ok: false, error: "We couldn’t reserve your order. Please try again." },
      { status: 200 },
    );
  }
}
