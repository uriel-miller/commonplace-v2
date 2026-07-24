// Blog / articles data access — reads the `BlogPost` table (populated by
// scripts/import-blog.mjs from the live WordPress REST API). Server-only.
//
// Every function is fail-soft: if the DB is unavailable or a query throws, it
// returns an empty result / null so the blog UI degrades gracefully and never
// crashes a page.

import { prisma } from "./db";

export interface BlogSummary {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  coverImage: string | null;
  category: string | null;
  publishedAt: string; // ISO
}
export interface BlogArticle extends BlogSummary {
  contentHtml: string;
}

const SUMMARY_SELECT = {
  id: true, slug: true, title: true, excerpt: true, coverImage: true, category: true, publishedAt: true,
} as const;

type Row = {
  id: number; slug: string; title: string; excerpt: string;
  coverImage: string | null; category: string | null; publishedAt: Date; contentHtml?: string;
};

function toSummary(r: Row): BlogSummary {
  return {
    id: r.id, slug: r.slug, title: r.title, excerpt: r.excerpt,
    coverImage: r.coverImage, category: r.category,
    publishedAt: (r.publishedAt instanceof Date ? r.publishedAt : new Date(r.publishedAt)).toISOString(),
  };
}

export interface BlogPage {
  items: BlogSummary[];
  total: number;
  page: number;
  totalPages: number;
}

/** Paginated list of posts, newest first. Never throws. */
export async function listBlogPosts(opts?: { page?: number; perPage?: number }): Promise<BlogPage> {
  const page = Math.max(1, Math.floor(opts?.page ?? 1));
  const perPage = Math.min(60, Math.max(1, Math.floor(opts?.perPage ?? 24)));
  if (!prisma) return { items: [], total: 0, page, totalPages: 0 };
  try {
    const [rows, total] = await Promise.all([
      prisma.blogPost.findMany({
        orderBy: { publishedAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
        select: SUMMARY_SELECT,
      }),
      prisma.blogPost.count(),
    ]);
    return { items: rows.map((r) => toSummary(r as Row)), total, page, totalPages: Math.max(1, Math.ceil(total / perPage)) };
  } catch (err) {
    console.warn("[blog] listBlogPosts failed", err);
    return { items: [], total: 0, page, totalPages: 0 };
  }
}

/** One full article by slug. Returns null when missing / on error. */
export async function getBlogPostBySlug(slug: string): Promise<BlogArticle | null> {
  if (!prisma || !slug) return null;
  try {
    const r = (await prisma.blogPost.findUnique({ where: { slug: slug.trim() } })) as Row | null;
    if (!r) return null;
    return { ...toSummary(r), contentHtml: r.contentHtml ?? "" };
  } catch (err) {
    console.warn("[blog] getBlogPostBySlug failed", err);
    return null;
  }
}
