// Real phone-OTP auth for the marketplace. Server-only.
//
// Flow: POST /api/auth/otp {action:"send"} texts a 6-digit code (hashed at rest)
// → {action:"verify"} checks it, upserts a User by phone, mints a Session, and
// sets an httpOnly `cp_session` cookie. /api/auth/me restores the session.
//
// Production hardening: every DB touch distinguishes "no DB", "schema not
// migrated / stale client", and "transient error" (with one bounded retry), and
// returns a typed reason instead of throwing. Codes are salted-hashed and never
// stored or logged in plaintext by this module.

import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

export const SESSION_COOKIE = "cp_session";
const SESSION_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 days
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_SENDS_PER_WINDOW = 5;
const OTP_SEND_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/** Typed failure reasons so callers/routes can map to precise messages + logs. */
export type AuthErrorReason =
  | "no-db"          // DATABASE_URL unset — Prisma client is null
  | "not-migrated"   // client/schema out of sync (model accessor missing) or table absent
  | "rate-limited"
  | "expired"
  | "invalid"
  | "locked"
  | "db-error";      // transient/unknown DB failure (already retried)

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) {
    // Loud in production: a missing secret means codes/sessions aren't bound to
    // an app-specific key. Still functions (dev), but must be set before launch.
    if (process.env.NODE_ENV === "production") {
      console.error("[auth] AUTH_SECRET is not set — set it before production use.");
    }
    return "cp-dev-secret-change-me";
  }
  return s;
}

/** Salted, non-reversible hash of a code, bound to the phone so codes aren't portable. */
export function hashCode(code: string, phone: string): string {
  return createHash("sha256").update(`${code}:${phone}:${secret()}`).digest("hex");
}

/** Constant-time comparison of two equal-length hex hashes. */
function hashesEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ba.length !== bb.length || ba.length === 0) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/** A cryptographically-strong opaque session token. */
export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** A 6-digit numeric OTP (000000–999999, uniformly random via CSPRNG). */
export function newOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/* ---------------------------- DB safety helpers --------------------------- */

/** Returns the live Prisma client only when it actually exposes the auth models
 *  (guards against a stale dev client cached before these tables were added),
 *  else null. Narrows the type so callers can use it without null-checks. */
function authDb(): NonNullable<typeof prisma> | null {
  if (prisma && prisma.user && prisma.session && prisma.otpCode) return prisma;
  return null;
}

/** Prisma error codes that indicate the schema hasn't been migrated. */
function isNotMigrated(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  // P2021 table does not exist, P2022 column does not exist.
  return code === "P2021" || code === "P2022";
}

/** Run a DB op with one bounded retry for transient connection blips. */
async function withRetry<T>(op: () => Promise<T>): Promise<T> {
  try {
    return await op();
  } catch (err) {
    if (isNotMigrated(err)) throw err; // not transient — surface immediately
    await new Promise((r) => setTimeout(r, 150));
    return await op();
  }
}

/* --------------------------------- OTP ------------------------------------ */

export interface CreateOtpResult {
  ok: boolean;
  code?: string; // returned to the CALLER only; the route decides whether to expose it
  error?: AuthErrorReason;
  retryAfterMs?: number;
}

/** Rate-limit + create a fresh OTP for a phone. Returns the plaintext code to the route. */
export async function createOtp(phone: string): Promise<CreateOtpResult> {
  if (!prisma) return { ok: false, error: "no-db" };
  const db = authDb();
  if (!db) {
    console.error("[auth] OTP models missing on the Prisma client (schema not migrated or stale client).");
    return { ok: false, error: "not-migrated" };
  }
  try {
    const now = Date.now();
    const since = new Date(now - OTP_SEND_WINDOW_MS);
    const recent = await withRetry(() => db.otpCode.count({ where: { phone, createdAt: { gt: since } } }));
    if (recent >= OTP_MAX_SENDS_PER_WINDOW) {
      return { ok: false, error: "rate-limited", retryAfterMs: OTP_SEND_WINDOW_MS };
    }

    const code = newOtp();
    await withRetry(() =>
      db.otpCode.create({
        data: { phone, codeHash: hashCode(code, phone), expiresAt: new Date(now + OTP_TTL_MS) },
      }),
    );

    // Opportunistic cleanup of this phone's stale codes (best-effort, non-blocking).
    void db.otpCode
      .deleteMany({ where: { phone, OR: [{ expiresAt: { lt: new Date(now) } }, { consumed: true }] } })
      .catch(() => {});

    return { ok: true, code };
  } catch (err) {
    if (isNotMigrated(err)) return { ok: false, error: "not-migrated" };
    console.error("[auth] createOtp failed:", err instanceof Error ? err.message : err);
    return { ok: false, error: "db-error" };
  }
}

export interface VerifyOtpResult {
  ok: boolean;
  userId?: string;
  error?: AuthErrorReason;
}

/** Verify a code for a phone. On success returns the (upserted) user id. */
export async function verifyOtp(phone: string, code: string): Promise<VerifyOtpResult> {
  if (!prisma) return { ok: false, error: "no-db" };
  const db = authDb();
  if (!db) return { ok: false, error: "not-migrated" };
  try {
    const row = await withRetry(() =>
      db.otpCode.findFirst({
        where: { phone, consumed: false, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
      }),
    );
    if (!row) return { ok: false, error: "expired" };
    if (row.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, error: "locked" };

    if (!hashesEqual(row.codeHash, hashCode(code, phone))) {
      await db.otpCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } }).catch(() => {});
      return { ok: false, error: "invalid" };
    }

    // Atomically consume the code and upsert the user so a double-submit can't
    // create two sessions off one code.
    const [, user] = await db.$transaction([
      db.otpCode.update({ where: { id: row.id }, data: { consumed: true } }),
      db.user.upsert({ where: { phone }, update: {}, create: { phone }, select: { id: true } }),
    ]);
    return { ok: true, userId: user.id };
  } catch (err) {
    if (isNotMigrated(err)) return { ok: false, error: "not-migrated" };
    console.error("[auth] verifyOtp failed:", err instanceof Error ? err.message : err);
    return { ok: false, error: "db-error" };
  }
}

/* ------------------------------- sessions --------------------------------- */

/** Create a Session row + set the httpOnly cookie. Returns the token, or null on failure. */
export async function startSession(userId: string, userAgent?: string): Promise<string | null> {
  const db = authDb();
  if (!db) return null;
  try {
    const token = newSessionToken();
    await withRetry(() =>
      db.session.create({
        data: { token, userId, userAgent: userAgent?.slice(0, 300), expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
      }),
    );
    const store = await cookies();
    store.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
    });
    return token;
  } catch (err) {
    console.error("[auth] startSession failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export interface SessionUser {
  id: string;
  phone: string;
  email: string | null;
  name: string | null;
}

/** Resolve the current logged-in user from the session cookie, or null. Never throws. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const db = authDb();
  if (!db) return null;
  try {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const session = await withRetry(() =>
      db.session.findUnique({
        where: { token },
        select: { expiresAt: true, user: { select: { id: true, phone: true, email: true, name: true } } },
      }),
    );
    if (!session || session.expiresAt.getTime() < Date.now()) return null;
    return session.user;
  } catch {
    return null;
  }
}

/** Destroy the current session (DB row + cookie). Never throws. */
export async function endSession(): Promise<void> {
  try {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    const db = authDb();
    if (token && db) {
      await db.session.deleteMany({ where: { token } }).catch(() => {});
    }
    store.delete(SESSION_COOKIE);
  } catch {
    /* best-effort */
  }
}
