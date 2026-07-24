"use client";

import { useCallback, useEffect, useState } from "react";
import { css, sx, Hoverable } from "@/lib/design/css";

/* Commonplace blog / buying guides. Fetches from /api/blog (list) and
   /api/blog/[slug] (article). Fully fail-soft: empty/error states never crash. */

interface Summary {
  id: number; slug: string; title: string; excerpt: string;
  coverImage: string | null; category: string | null; publishedAt: string;
}
interface Article extends Summary { contentHtml: string }

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return ""; }
}

export function BlogView({ initialSlug }: { initialSlug?: string }) {
  const [items, setItems] = useState<Summary[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingList, setLoadingList] = useState(true);
  const [article, setArticle] = useState<Article | null>(null);
  const [loadingArticle, setLoadingArticle] = useState(!!initialSlug);
  const [error, setError] = useState<string | null>(null);

  const loadList = useCallback(async (p: number) => {
    setLoadingList(true);
    try {
      const r = await fetch(`/api/blog?page=${p}&perPage=24`);
      const d = (await r.json()) as { items?: Summary[]; totalPages?: number };
      setItems((prev) => (p === 1 ? (d.items ?? []) : [...prev, ...(d.items ?? [])]));
      setTotalPages(Math.max(1, d.totalPages ?? 1));
      setPage(p);
    } catch { /* fail-soft */ } finally { setLoadingList(false); }
  }, []);

  const openArticle = useCallback(async (slug: string) => {
    setLoadingArticle(true); setError(null);
    try {
      const r = await fetch(`/api/blog/${encodeURIComponent(slug)}`);
      const d = (await r.json()) as { article?: Article | null; error?: string };
      if (!r.ok || !d.article) { setError(d.error || "Article not found."); setArticle(null); }
      else { setArticle(d.article); try { document.querySelector("main")?.scrollTo({ top: 0 }); } catch { /* ignore */ } }
    } catch { setError("Couldn't load that article."); } finally { setLoadingArticle(false); }
  }, []);

  useEffect(() => { void loadList(1); }, [loadList]);
  useEffect(() => { if (initialSlug) void openArticle(initialSlug); }, [initialSlug, openArticle]);

  /* ---------------------------- Article detail ---------------------------- */
  if (article || loadingArticle) {
    return (
      <div style={css("max-width:800px;margin:0 auto;padding:8px 22px 80px")}>
        <Hoverable as="a" onClick={() => { setArticle(null); setError(null); }} styles="display:inline-flex;align-items:center;gap:5px;font-size:14px;font-weight:600;color:var(--blueInk);cursor:pointer;margin-bottom:18px" hover="color:var(--maroon)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>All articles
        </Hoverable>
        {loadingArticle ? (
          <div style={css("padding:60px 0;text-align:center;color:var(--muted)")}>Loading…</div>
        ) : article ? (
          <article>
            {article.category && <div style={css("font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--maroon);margin-bottom:10px")}>{article.category}</div>}
            <h1 style={css("font-family:'Reckless','Newsreader',serif;font-size:34px;font-weight:600;line-height:1.15;letter-spacing:-.4px;margin-bottom:8px")}>{article.title}</h1>
            <div style={css("font-size:13px;color:var(--muted);margin-bottom:22px")}>{fmtDate(article.publishedAt)}</div>
            {article.coverImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={article.coverImage} alt="" style={css("width:100%;border-radius:16px;margin-bottom:24px;display:block")} />
            )}
            <div className="cp-article" style={css("font-size:16px;line-height:1.7;color:var(--ink)")} dangerouslySetInnerHTML={{ __html: article.contentHtml }} />
            <style>{".cp-article h2{font-family:'Reckless','Newsreader',serif;font-size:24px;font-weight:600;margin:30px 0 12px;line-height:1.25}.cp-article h3{font-weight:700;font-size:18px;margin:22px 0 8px}.cp-article p{margin:0 0 16px}.cp-article ul,.cp-article ol{margin:0 0 16px;padding-left:22px}.cp-article li{margin:0 0 7px}.cp-article a{color:var(--maroon);text-decoration:underline}.cp-article img{max-width:100%;height:auto;border-radius:12px;margin:14px 0}.cp-article strong{color:var(--ink)}"}</style>
          </article>
        ) : (
          <div style={css("padding:40px 0;text-align:center;color:var(--muted)")}>{error || "Article not found."}</div>
        )}
      </div>
    );
  }

  /* ------------------------------ Article list ---------------------------- */
  return (
    <div style={css("max-width:1180px;margin:0 auto;padding:8px 22px 80px")}>
      <div style={css("margin-bottom:22px")}>
        <div style={css("font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--maroon);margin-bottom:8px")}>The Commonplace Blog</div>
        <h1 style={css("font-family:'Reckless','Newsreader',serif;font-size:32px;font-weight:500;letter-spacing:-.4px")}>Guides & articles</h1>
        <p style={css("font-size:14.5px;color:var(--muted);margin-top:4px")}>Buying guides, how-tos, and everything you need to buy and sell used with confidence.</p>
      </div>

      {loadingList && items.length === 0 ? (
        <div style={css("padding:60px 0;text-align:center;color:var(--muted)")}>Loading articles…</div>
      ) : items.length === 0 ? (
        <div style={css("padding:50px 0;text-align:center;color:var(--muted)")}>No articles yet — check back soon.</div>
      ) : (
        <>
          <div style={css("display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px")}>
            {items.map((a) => (
              <Hoverable key={a.id} as="div" onClick={() => openArticle(a.slug)} styles="cursor:pointer;background:var(--paper);border:1px solid var(--line);border-radius:16px;overflow:hidden;display:flex;flex-direction:column" hover="transform:translateY(-2px);box-shadow:0 14px 34px rgba(60,10,35,.12)">
                <div style={sx("width:100%;aspect-ratio:16/10;background:repeating-linear-gradient(135deg,#EDE4D6 0 14px,#E5DACA 14px 28px)")}>
                  {a.coverImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.coverImage} alt="" loading="lazy" style={css("width:100%;height:100%;object-fit:cover;display:block")} />
                  )}
                </div>
                <div style={css("padding:15px 16px 17px;display:flex;flex-direction:column;flex:1")}>
                  {a.category && <div style={css("font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-bottom:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{a.category}</div>}
                  <div style={css("font-family:'Reckless','Newsreader',serif;font-size:17px;font-weight:600;line-height:1.25;color:var(--ink)")}>{a.title}</div>
                  <div style={css("font-size:13px;color:var(--muted);line-height:1.5;margin-top:7px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical")}>{a.excerpt}</div>
                  <div style={css("font-size:12px;color:var(--muted);margin-top:auto;padding-top:10px")}>{fmtDate(a.publishedAt)}</div>
                </div>
              </Hoverable>
            ))}
          </div>
          {page < totalPages && (
            <div style={css("text-align:center;margin-top:28px")}>
              <Hoverable as="button" onClick={() => void loadList(page + 1)} styles="background:var(--paper);color:var(--ink);border:1px solid var(--line);border-radius:26px;padding:12px 28px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit" hover="border-color:var(--maroon);color:var(--maroon)">{loadingList ? "Loading…" : "Load more articles"}</Hoverable>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default BlogView;
