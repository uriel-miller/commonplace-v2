// /api/offers — create (POST) and list (GET ?role=buyer|seller) offers.
// Every handler wraps logic in try/catch and NEVER throws to the client:
// bad input → typed 4xx JSON, everything else → safe fallback + 200.

import type { NextRequest } from "next/server";
import {
  createOffer,
  parseCreateOfferInput,
  listOffersForBuyer,
  listOffersForSeller,
  type OfferDTO,
} from "@/lib/offers";

// Offers are inherently dynamic (per-request DB state); never cache.
export const dynamic = "force-dynamic";

interface ListResponse {
  offers: OfferDTO[];
  role: "buyer" | "seller";
}

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const roleRaw = req.nextUrl.searchParams.get("role");
    const role: "buyer" | "seller" = roleRaw === "seller" ? "seller" : "buyer";
    const buyerName = req.nextUrl.searchParams.get("buyer") ?? undefined;

    const offers =
      role === "seller"
        ? await listOffersForSeller()
        : await listOffersForBuyer(buyerName);

    const body: ListResponse = { offers, role };
    return Response.json(body, { status: 200 });
  } catch (err) {
    console.warn("[api/offers][GET] failed", err);
    // Fail soft: empty list keeps the UI functional.
    return Response.json({ offers: [], role: "buyer" } satisfies ListResponse, {
      status: 200,
    });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "invalid-json", offer: null }, { status: 400 });
  }

  const input = parseCreateOfferInput(body);
  if (!input) {
    return Response.json(
      { ok: false, error: "invalid-offer", offer: null },
      { status: 400 },
    );
  }

  try {
    const result = await createOffer(input);
    // createOffer already fail-softs; surface its ok flag but always 200 so the
    // client gets a typed body it can branch on.
    return Response.json(result, { status: 200 });
  } catch (err) {
    console.warn("[api/offers][POST] failed", err);
    return Response.json({ ok: false, error: "server-error", offer: null }, { status: 200 });
  }
}
