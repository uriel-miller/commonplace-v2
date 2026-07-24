/**
 * POST /api/auth/otp — the phone-OTP login endpoint (send + verify).
 *
 *   { action: "send",   phone }         → text a 6-digit code (hashed at rest)
 *   { action: "verify", phone, code }   → verify, create session, set cookie
 *
 * Fails soft: never throws to the client. In non-production (or when
 * AUTH_DEV_CODES=1) the send response includes `devCode` so the flow is
 * testable before Quo credentials are wired. Production never leaks the code.
 */

import type { NextRequest } from "next/server";
import { createOtp, verifyOtp, startSession } from "@/lib/auth";
import { sendSms, toE164 } from "@/lib/sms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  action?: unknown;
  phone?: unknown;
  code?: unknown;
}

function devCodesEnabled(smsConfigured: boolean): boolean {
  if (process.env.AUTH_DEV_CODES === "1") return true;
  return !smsConfigured && process.env.NODE_ENV !== "production";
}

export async function POST(req: NextRequest): Promise<Response> {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";
  const phoneRaw = typeof body.phone === "string" ? body.phone : "";
  const e164 = toE164(phoneRaw);
  if (!e164) return Response.json({ ok: false, error: "Enter a valid US phone number." }, { status: 400 });

  /* ------------------------------- send -------------------------------- */
  if (action === "send") {
    const res = await createOtp(e164);
    if (!res.ok || !res.code) {
      if (res.error === "rate-limited") {
        return Response.json({ ok: false, error: "Too many codes requested. Please wait a few minutes." }, { status: 429 });
      }
      if (res.error === "no-db" || res.error === "not-migrated") {
        console.error(`[auth] send blocked: ${res.error}`);
        return Response.json({ ok: false, error: "Sign-in is temporarily unavailable. Please try again shortly." }, { status: 503 });
      }
      return Response.json({ ok: false, error: "Could not send a code right now. Please try again." }, { status: 503 });
    }

    const sms = await sendSms(e164, `Your Commonplace code is ${res.code}. It expires in 5 minutes.`);
    // Always log server-side so operators can read it from Railway logs pre-Quo.
    if (!sms.sent) console.warn(`[auth] OTP for ${e164}: ${res.code} (sms not sent: ${sms.reason ?? "unknown"})`);

    const payload: { ok: true; smsSent: boolean; devCode?: string } = { ok: true, smsSent: sms.sent };
    if (devCodesEnabled(sms.sent)) payload.devCode = res.code;
    return Response.json(payload);
  }

  /* ------------------------------ verify ------------------------------- */
  if (action === "verify") {
    const code = typeof body.code === "string" ? body.code.replace(/\D/g, "").slice(0, 6) : "";
    if (code.length !== 6) return Response.json({ ok: false, error: "Enter the 6-digit code." }, { status: 400 });

    const res = await verifyOtp(e164, code);
    if (!res.ok || !res.userId) {
      if (res.error === "no-db" || res.error === "not-migrated") {
        console.error(`[auth] verify blocked: ${res.error}`);
        return Response.json({ ok: false, error: "Sign-in is temporarily unavailable. Please try again shortly." }, { status: 503 });
      }
      const msg =
        res.error === "invalid" ? "That code is not correct."
        : res.error === "locked" ? "Too many attempts. Request a new code."
        : res.error === "expired" ? "That code expired. Request a new one."
        : "Could not verify your code.";
      return Response.json({ ok: false, error: msg }, { status: 400 });
    }

    const token = await startSession(res.userId, req.headers.get("user-agent") ?? undefined);
    if (!token) {
      return Response.json({ ok: false, error: "Could not start your session. Please try again." }, { status: 503 });
    }
    return Response.json({ ok: true, user: { id: res.userId, phone: e164 } });
  }

  return Response.json({ ok: false, error: "Unknown action." }, { status: 400 });
}
