/**
 * Phone-side upload endpoint for the photo-handoff flow.
 *
 *   GET  /api/sell/photo-session/upload?code=…  → validate a code (mobile page load)
 *   POST /api/sell/photo-session/upload          → append photos to the session
 *
 * The phone identifies its session by the short `code` from the SMS/link. The
 * desktop can only READ photos via the separate secret `token`, so a leaked
 * code lets someone add photos but never read another seller's.
 */

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const MAX_PHOTOS = 12;
const MAX_BYTES_PER_PHOTO = 8 * 1024 * 1024; // ~8MB decoded guard per image

function cleanCode(v: unknown): string {
  return typeof v === "string" ? v.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) : "";
}

/** Keep only well-formed image data URLs under the size guard. */
function sanitizePhotos(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    if (typeof x !== "string") continue;
    if (!x.startsWith("data:image/")) continue;
    if (x.length > MAX_BYTES_PER_PHOTO) continue;
    out.push(x);
  }
  return out;
}

/* ---------------------------------- GET ----------------------------------- */

export async function GET(req: NextRequest): Promise<Response> {
  if (!prisma) return Response.json({ valid: false, reason: "unavailable" }, { status: 200 });
  const code = cleanCode(new URL(req.url).searchParams.get("code"));
  if (!code) return Response.json({ valid: false, reason: "missing" }, { status: 200 });

  try {
    const s = await prisma.photoSession.findUnique({
      where: { code },
      select: { status: true, expiresAt: true, photos: true },
    });
    if (!s) return Response.json({ valid: false, reason: "not_found" }, { status: 200 });
    if (s.expiresAt.getTime() < Date.now()) return Response.json({ valid: false, reason: "expired" }, { status: 200 });
    const count = Array.isArray(s.photos) ? s.photos.length : 0;
    return Response.json({ valid: s.status === "open", reason: s.status, count });
  } catch {
    return Response.json({ valid: false, reason: "error" }, { status: 200 });
  }
}

/* --------------------------------- POST ----------------------------------- */

export async function POST(req: NextRequest): Promise<Response> {
  if (!prisma) return Response.json({ ok: false, error: "unavailable" }, { status: 503 });

  let body: { code?: unknown; photos?: unknown } = {};
  try {
    body = (await req.json()) as { code?: unknown; photos?: unknown };
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const code = cleanCode(body.code);
  const incoming = sanitizePhotos(body.photos);
  if (!code) return Response.json({ ok: false, error: "A code is required." }, { status: 400 });
  if (incoming.length === 0) return Response.json({ ok: false, error: "No valid photos supplied." }, { status: 400 });

  try {
    const s = await prisma.photoSession.findUnique({
      where: { code },
      select: { photos: true, status: true, expiresAt: true },
    });
    if (!s) return Response.json({ ok: false, error: "That code is not valid." }, { status: 404 });
    if (s.expiresAt.getTime() < Date.now() || s.status !== "open") {
      return Response.json({ ok: false, error: "This upload link has expired." }, { status: 410 });
    }

    const existing = Array.isArray(s.photos) ? (s.photos as unknown[]).filter((x): x is string => typeof x === "string") : [];
    const merged = [...existing, ...incoming].slice(0, MAX_PHOTOS);

    await prisma.photoSession.update({ where: { code }, data: { photos: merged } });
    return Response.json({ ok: true, count: merged.length, added: merged.length - existing.length });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "Upload failed." },
      { status: 500 },
    );
  }
}
