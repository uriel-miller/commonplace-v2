import { listBlogPosts } from "@/lib/blog";

export const dynamic = "force-dynamic";

/** GET /api/blog?page=1&perPage=24 — paginated article summaries (newest first). */
export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const page = Number(sp.get("page") || "1");
    const perPage = Number(sp.get("perPage") || "24");
    const data = await listBlogPosts({ page, perPage });
    return Response.json(data);
  } catch (err) {
    console.warn("[api/blog] failed", err);
    return Response.json({ items: [], total: 0, page: 1, totalPages: 0 });
  }
}
