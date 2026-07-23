import type { NextRequest } from "next/server";
import { checkAdminToken, adminConfigured, ADMIN_COOKIE, COOKIE_MAX_AGE } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

/** POST { token } → sets the admin cookie when the token matches. Fail-closed. */
export async function POST(req: NextRequest) {
  if (!adminConfigured()) {
    return Response.json({ ok: false, error: "admin_not_configured" }, { status: 503 });
  }
  let input: unknown = "";
  try {
    input = (await req.json())?.token;
  } catch {
    input = "";
  }
  if (!checkAdminToken(input)) {
    return Response.json({ ok: false, error: "invalid_token" }, { status: 401 });
  }
  const token = process.env.ADMIN_TOKEN as string;
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  const res = Response.json({ ok: true });
  res.headers.append(
    "Set-Cookie",
    `${ADMIN_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax;${secure} Max-Age=${COOKIE_MAX_AGE}`,
  );
  return res;
}

/** DELETE → log out (clear the cookie). */
export async function DELETE() {
  const res = Response.json({ ok: true });
  res.headers.append("Set-Cookie", `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return res;
}
