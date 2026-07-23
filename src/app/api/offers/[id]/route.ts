// /api/offers/[id] — PATCH: seller responds accept|counter|decline.
// Fail-soft: bad input → typed 4xx, everything else → typed body + 200.

import type { NextRequest } from "next/server";
import { respondToOffer, type OfferAction } from "@/lib/offers";

export const dynamic = "force-dynamic";

const ACTIONS: readonly OfferAction[] = ["accept", "counter", "decline"];

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  let id = "";
  try {
    id = (await ctx.params).id;
  } catch {
    /* fall through to bad-id below */
  }
  if (!id) {
    return Response.json({ ok: false, error: "missing-id", offer: null }, { status: 400 });
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "invalid-json", offer: null }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const action = b.action;
  if (typeof action !== "string" || !(ACTIONS as readonly string[]).includes(action)) {
    return Response.json({ ok: false, error: "invalid-action", offer: null }, { status: 400 });
  }

  const counterRaw = b.counterCents;
  const counterCents =
    typeof counterRaw === "number"
      ? counterRaw
      : counterRaw != null
        ? Number(counterRaw)
        : undefined;

  if (action === "counter" && (!Number.isFinite(counterCents ?? NaN) || (counterCents ?? 0) <= 0)) {
    return Response.json(
      { ok: false, error: "invalid-counter", offer: null },
      { status: 400 },
    );
  }

  try {
    const result = await respondToOffer(id, action as OfferAction, counterCents);
    return Response.json(result, { status: 200 });
  } catch (err) {
    console.warn("[api/offers/[id]][PATCH] failed", err);
    return Response.json({ ok: false, error: "server-error", offer: null }, { status: 200 });
  }
}
