import { getBlogPostBySlug } from "@/lib/blog";

export const dynamic = "force-dynamic";

/** GET /api/blog/[slug] — one full article. */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  let slug = "";
  try { slug = (await ctx.params).slug; } catch { /* bad input */ }
  if (!slug) return Response.json({ article: null, error: "Missing slug." }, { status: 400 });
  try {
    const article = await getBlogPostBySlug(slug);
    if (!article) return Response.json({ article: null, error: "Article not found." }, { status: 404 });
    return Response.json({ article });
  } catch (err) {
    console.warn("[api/blog/[slug]] failed", err);
    return Response.json({ article: null, error: String(err) }, { status: 200 });
  }
}
