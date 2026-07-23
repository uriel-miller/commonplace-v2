// /api/admin/offers — GET: every offer across all listings, newest first.
// Admin-guarded (isAdmin). Reuses listOffersForSeller() (returns all offers).
// Responding to an offer reuses the existing PATCH /api/offers/[id] route.
// Fail-soft: any error → empty list + 200.

import type { NextRequest } from "next/server";
import { listOffersForSeller, type OfferDTO } from "@/lib/offers";
import { isAdmin } from "@/lib/adminAuth";
import { safeJson } from "@/lib/resilience";

export const dynamic = "force-dynamic";

export interface AdminOffersResponse {
  ok: boolean;
  offers: OfferDTO[];
}

export async function GET(req: NextRequest): Promise<Response> {
  let ok = false;
  try {
    ok = await isAdmin(req);
  } catch {
    ok = false;
  }
  if (!ok) {
    return Response.json({ ok: false, offers: [] } satisfies AdminOffersResponse, {
      status: 401,
    });
  }

  const offers = await safeJson<OfferDTO[]>(
    () => listOffersForSeller(),
    [],
    "api/admin/offers GET",
  );

  return Response.json({ ok: true, offers } satisfies AdminOffersResponse, { status: 200 });
}
