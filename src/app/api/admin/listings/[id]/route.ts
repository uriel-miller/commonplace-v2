/**
 * PATCH  /api/admin/listings/[id]  — edit price/title/condition/category.
 * DELETE /api/admin/listings/[id]  — remove a listing.
 *
 * Admin-only (shared `isAdmin` gate; non-admins → 401). Every DB touch is
 * null-checked and wrapped in try/catch — the route NEVER throws to the client
 * and returns fail-soft JSON. Money stays in integer cents. Listing ids are the
 * WooCommerce product id (integer), so the [id] segment is parsed as an int.
 */

import type { NextRequest } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

interface MutationResponse {
  ok: boolean;
  id?: number;
  error?: string;
  warning?: string;
}

interface PatchBody {
  title?: unknown;
  priceCents?: unknown;
  condition?: unknown;
  categorySlug?: unknown;
  categoryName?: unknown;
}

/** Parse the dynamic [id] segment into a positive integer, or null if invalid. */
function parseId(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

/** Non-negative integer cents, or undefined if the value is unusable. */
function asCents(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.round(v));
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(n)) return Math.max(0, Math.round(n));
  }
  return undefined;
}

/** Trimmed non-empty string, or undefined. */
function asStr(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t === "" ? undefined : t;
}

function unauthorized(): Response {
  return Response.json({ ok: false, error: "Unauthorized" } satisfies MutationResponse, {
    status: 401,
  });
}

type Ctx = { params: Promise<{ id: string }> };

/* ---------------------------------- PATCH --------------------------------- */

export async function PATCH(req: NextRequest, ctx: Ctx): Promise<Response> {
  try {
    if (!isAdmin(req)) return unauthorized();
  } catch {
    return unauthorized();
  }

  const { id: rawId } = await ctx.params.catch(() => ({ id: "" }));
  const id = parseId(rawId);
  if (id == null) {
    return Response.json({ ok: false, error: "Invalid listing id." }, { status: 400 });
  }

  let raw: PatchBody;
  try {
    raw = (await req.json()) as PatchBody;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }
  if (!raw || typeof raw !== "object") {
    return Response.json({ ok: false, error: "Body must be a JSON object." }, { status: 400 });
  }

  // Build a partial update from only the fields the caller provided.
  const data: {
    title?: string;
    priceCents?: number;
    condition?: string;
    categorySlug?: string;
    categoryName?: string;
  } = {};

  const title = asStr(raw.title);
  if (title !== undefined) data.title = title;

  const priceCents = asCents(raw.priceCents);
  if (priceCents !== undefined) data.priceCents = priceCents;

  // condition may be intentionally cleared with an empty string.
  if (typeof raw.condition === "string") {
    const c = raw.condition.trim();
    data.condition = c; // empty string clears it
  }

  const categorySlug = asStr(raw.categorySlug);
  if (categorySlug !== undefined) data.categorySlug = categorySlug;
  const categoryName = asStr(raw.categoryName);
  if (categoryName !== undefined) data.categoryName = categoryName;

  if (Object.keys(data).length === 0) {
    return Response.json({ ok: false, error: "No editable fields provided." }, { status: 400 });
  }

  if (!prisma) {
    return Response.json(
      { ok: false, error: "No database configured — edits are unavailable." },
      { status: 200 },
    );
  }

  try {
    // condition column is nullable; map empty string to null.
    const updated = await prisma.listing.update({
      where: { id },
      data: {
        ...data,
        ...(data.condition !== undefined ? { condition: data.condition || null } : {}),
      },
      select: { id: true },
    });
    return Response.json({ ok: true, id: updated.id } satisfies MutationResponse, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Prisma "record not found" surfaces as P2025.
    const notFound = /P2025|not found|No .* found/i.test(msg);
    return Response.json(
      { ok: false, error: notFound ? "Listing not found." : `Update failed: ${msg}` },
      { status: notFound ? 404 : 200 },
    );
  }
}

/* --------------------------------- DELETE --------------------------------- */

export async function DELETE(req: NextRequest, ctx: Ctx): Promise<Response> {
  try {
    if (!isAdmin(req)) return unauthorized();
  } catch {
    return unauthorized();
  }

  const { id: rawId } = await ctx.params.catch(() => ({ id: "" }));
  const id = parseId(rawId);
  if (id == null) {
    return Response.json({ ok: false, error: "Invalid listing id." }, { status: 400 });
  }

  if (!prisma) {
    return Response.json(
      { ok: false, error: "No database configured — deletes are unavailable." },
      { status: 200 },
    );
  }

  try {
    await prisma.listing.delete({ where: { id }, select: { id: true } });
    return Response.json({ ok: true, id } satisfies MutationResponse, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const notFound = /P2025|not found|No .* found/i.test(msg);
    return Response.json(
      { ok: false, error: notFound ? "Listing not found." : `Delete failed: ${msg}` },
      { status: notFound ? 404 : 200 },
    );
  }
}
