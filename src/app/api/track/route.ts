import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/* Analytics ingest — POST a batch of events. Designed to NEVER slow down or break
   the client: it validates/caps input, writes best-effort, and always returns 204
   quickly (even if the DB is down). Fire-and-forget from the browser (sendBeacon). */

const MAX_BATCH = 100;
const STR = (v: unknown, max = 512) => (typeof v === "string" ? v.slice(0, max) : null);
const INT = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : null);

interface RawEvent {
  anonId?: string; sessionId?: string; userId?: string;
  type?: string; name?: string; screen?: string; path?: string;
  listingId?: number; categorySlug?: string; props?: unknown;
  referrer?: string; viewportW?: number; viewportH?: number; ts?: string | number;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as { events?: RawEvent[] } | null;
    const raw = Array.isArray(body?.events) ? body!.events!.slice(0, MAX_BATCH) : [];
    if (raw.length === 0 || !prisma) return new Response(null, { status: 204 });

    const rows = raw
      .map((e) => {
        const anonId = STR(e.anonId, 64);
        const sessionId = STR(e.sessionId, 64);
        const name = STR(e.name, 128);
        if (!anonId || !sessionId || !name) return null;
        let props: object | null = null;
        try { props = e.props && typeof e.props === "object" ? (JSON.parse(JSON.stringify(e.props)) as object) : null; } catch { props = null; }
        const ts = e.ts != null ? new Date(e.ts) : new Date();
        return {
          anonId, sessionId,
          userId: STR(e.userId, 64),
          type: STR(e.type, 32) || "custom",
          name,
          screen: STR(e.screen, 64),
          path: STR(e.path, 512),
          listingId: INT(e.listingId),
          categorySlug: STR(e.categorySlug, 96),
          props: props ?? undefined,
          referrer: STR(e.referrer, 512),
          viewportW: INT(e.viewportW),
          viewportH: INT(e.viewportH),
          ts: Number.isNaN(ts.getTime()) ? new Date() : ts,
        };
      })
      .filter(Boolean) as object[];

    if (rows.length > 0) {
      // Best-effort; a write failure must never surface to the client.
      await prisma.analyticsEvent.createMany({ data: rows as never }).catch((err) => {
        console.warn("[api/track] write failed", err);
      });
    }
  } catch (err) {
    console.warn("[api/track] failed", err);
  }
  return new Response(null, { status: 204 });
}
