"use client";

import { useEffect, useState } from "react";
import { css, Hoverable } from "@/lib/design/css";

/* Compact "Articles & Guides" strip for the About page — pulls the latest posts
   from /api/blog and links to /blog/{slug} (resolved by the catch-all route).
   Fail-soft: renders nothing if there are no articles. */

interface Summary { id: number; slug: string; title: string; excerpt: string; coverImage: string | null; category: string | null }

export function AboutGuides() {
  const [items, setItems] = useState<Summary[]>([]);
  useEffect(() => {
    let alive = true;
    fetch("/api/blog?page=1&perPage=3")
      .then((r) => r.json())
      .then((d: { items?: Summary[] }) => { if (alive) setItems(Array.isArray(d.items) ? d.items : []); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (items.length === 0) return null;

  return (
    <section style={css("margin-top:40px")}>
      <div style={css("display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px")}>
        <h2 style={css("font-family:'Reckless','Newsreader',serif;font-size:24px;font-weight:600;letter-spacing:-.3px")}>Articles &amp; guides</h2>
        <a href="/blog" style={css("font-size:13.5px;font-weight:700;color:var(--maroon);text-decoration:none")}>See all →</a>
      </div>
      <div style={css("display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px")}>
        {items.map((a) => (
          <Hoverable key={a.id} as="a" href={`/blog/${a.slug}`} styles="text-decoration:none;background:var(--paper);border:1px solid var(--line);border-radius:14px;overflow:hidden;display:flex;flex-direction:column;cursor:pointer" hover="transform:translateY(-2px);box-shadow:0 12px 28px rgba(60,10,35,.1)">
            <div style={css("width:100%;aspect-ratio:16/10;background:repeating-linear-gradient(135deg,#EDE4D6 0 14px,#E5DACA 14px 28px)")}>
              {a.coverImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.coverImage} alt="" loading="lazy" style={css("width:100%;height:100%;object-fit:cover;display:block")} />
              )}
            </div>
            <div style={css("padding:12px 14px 14px")}>
              {a.category && <div style={css("font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-bottom:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{a.category}</div>}
              <div style={css("font-family:'Reckless','Newsreader',serif;font-size:15px;font-weight:600;line-height:1.25;color:var(--ink)")}>{a.title}</div>
            </div>
          </Hoverable>
        ))}
      </div>
    </section>
  );
}

export default AboutGuides;
