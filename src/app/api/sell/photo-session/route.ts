/**
 * Photo-handoff session API — lets a seller add listing photos from their phone.
 *
 *   POST /api/sell/photo-session         → open a session; text the link (best-effort)
 *   GET  /api/sell/photo-session?token=… → desktop poll: pull uploaded photos
 *
 * Every step fails soft. The endpoint never throws to the client; when there is
 * no database it returns a clear 503 so the UI can hide the phone-upload option.
 */

import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { sendSms, toE164 } from "@/lib/sms";

export const dynamic = "force-dynamic";

const TTL_MS = 30 * 60 * 1000; // sessions live 30 minutes

/** Unambiguous code alphabet (no O/0/I/1/L) for a text-friendly short code. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function makeCode(len = 6): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

function originFor(req: NextRequest): string {
  try {
    return new URL(req.url).origin;
  } catch {
    return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  }
}

/* --------------------------------- POST ----------------------------------- */

export async function POST(req: NextRequest): Promise<Response> {
  if (!prisma) {
    return Response.json({ error: "Phone uploads are unavailable right now." }, { status: 503 });
  }

  let body: { phone?: unknown } = {};
  try {
    body = (await req.json()) as { phone?: unknown };
  } catch {
    /* empty body is fine — phone is optional */
  }
  const phoneRaw = typeof body.phone === "string" ? body.phone.trim() : "";
  const e164 = toE164(phoneRaw);

  // Generate a code, retrying on the rare unique collision.
  let code = makeCode();
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + TTL_MS);

  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await prisma.photoSession.create({
          data: { code, token, phone: e164, photos: [], status: "open", expiresAt },
        });
        break;
      } catch {
        code = makeCode(); // collision (or transient) — try a fresh code
        if (attempt === 4) throw new Error("could not allocate a session code");
      }
    }
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Could not start a phone upload." },
      { status: 500 },
    );
  }

  const link = `${originFor(req)}/add-photos/${code}`;

  // QR of the link so the seller can scan from the desktop with no SMS at all.
  let qrSvg: string | null = null;
  try {
    const svg = await QRCode.toString(link, { type: "svg", margin: 1, width: 190, color: { dark: "#19171c", light: "#ffffff" } });
    qrSvg = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  } catch {
    qrSvg = null; // fall back to the copyable link
  }

  // Best-effort SMS. Never blocks or fails the request.
  let smsSent = false;
  if (e164) {
    const r = await sendSms(
      e164,
      `Add photos to your Commonplace listing: ${link}\n\nOr enter code ${code}. Link expires in 30 minutes.`,
    );
    smsSent = r.sent;
    if (smsSent) {
      try {
        await prisma.photoSession.update({ where: { code }, data: { smsSent: true } });
      } catch {
        /* non-fatal */
      }
    }
  }

  return Response.json({ ok: true, code, token, link, qrSvg, smsSent, expiresAt });
}

/* ---------------------------------- GET ----------------------------------- */

export async function GET(req: NextRequest): Promise<Response> {
  if (!prisma) return Response.json({ status: "unavailable", photos: [] }, { status: 200 });

  const token = new URL(req.url).searchParams.get("token")?.trim();
  if (!token) return Response.json({ error: "token is required." }, { status: 400 });

  try {
    const s = await prisma.photoSession.findUnique({
      where: { token },
      select: { photos: true, status: true, expiresAt: true },
    });
    if (!s) return Response.json({ status: "not_found", photos: [] }, { status: 200 });
    const expired = s.expiresAt.getTime() < Date.now();
    const photos = Array.isArray(s.photos) ? (s.photos as unknown[]).filter((x): x is string => typeof x === "string") : [];
    return Response.json({
      status: expired ? "expired" : s.status,
      photos,
      count: photos.length,
    });
  } catch {
    // Fail soft — desktop keeps its current photos and can retry.
    return Response.json({ status: "error", photos: [] }, { status: 200 });
  }
}
