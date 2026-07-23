// Admin auth — fail CLOSED. Access requires ADMIN_TOKEN to be configured AND a
// matching httpOnly cookie. If ADMIN_TOKEN is unset, NO ONE is admin (secure by
// default). This gates the whole /admin backend + every /api/admin/* route.

import { cookies } from "next/headers";

export const ADMIN_COOKIE = "cp_admin";
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

/** Constant-time string comparison (avoids timing leaks on the token). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function tokenFromCookieHeader(header: string | null): string {
  if (!header) return "";
  const m = header.match(/(?:^|;\s*)cp_admin=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

/** Route-handler guard: true only when ADMIN_TOKEN is set and the cookie matches. */
export function isAdmin(req: Request): boolean {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return false;
  return safeEqual(tokenFromCookieHeader(req.headers.get("cookie")), token);
}

/** Server-component guard (reads the request cookie jar). */
export async function isAdminServer(): Promise<boolean> {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return false;
  try {
    const jar = await cookies();
    return safeEqual(jar.get(ADMIN_COOKIE)?.value ?? "", token);
  } catch {
    return false;
  }
}

/** Validate a login attempt against the configured token. */
export function checkAdminToken(input: unknown): boolean {
  const token = process.env.ADMIN_TOKEN;
  if (!token || typeof input !== "string") return false;
  return safeEqual(input, token);
}

/** True when an ADMIN_TOKEN is configured at all (for a helpful "not set up" message). */
export function adminConfigured(): boolean {
  return !!process.env.ADMIN_TOKEN;
}
