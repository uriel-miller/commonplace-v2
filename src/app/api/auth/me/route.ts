/** GET /api/auth/me — the current logged-in user (from the session cookie), or null. */

import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const user = await getSessionUser();
  return Response.json({ user });
}
