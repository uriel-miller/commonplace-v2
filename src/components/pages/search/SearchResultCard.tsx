"use client";

import { css, sx, Hoverable } from "@/lib/design/css";
import { Pin } from "@/components/marketplace/icons";
import { formatPrice, type Listing } from "@/lib/listing";

/**
 * Search result card. Visually identical to the marketplace ProductCard so the
 * grid reads as one system, but self-contained inside the Search module.
 */
export function SearchResultCard({
  item,
  onClick,
  tint = "#EDE4D6",
  tint2 = "#E5DACA",
}: {
  item: Listing;
  onClick: () => void;
  tint?: string;
  tint2?: string;
}) {
  const img = item.images[0];
  return (
    <Hoverable
      as="button"
      onClick={onClick}
      styles="display:block;width:100%;text-align:left;padding:0;font-family:inherit;transition:box-shadow .2s ease,border-color .2s ease;background:var(--paper);border:1px solid var(--line);border-radius:12px;overflow:hidden;cursor:pointer;animation:pop .3s ease both;box-shadow:0 3px 10px rgba(60,10,35,.05)"
      hover="box-shadow:0 18px 38px rgba(60,10,35,.22);border-color:#d9b7c2"
    >
      <div style={sx("position:relative;aspect-ratio:4/3;overflow:hidden", { background: `repeating-linear-gradient(135deg,${tint} 0 15px,${tint2} 15px 30px)` })}>
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={item.title} loading="lazy" style={css("position:absolute;inset:0;width:100%;height:100%;object-fit:cover")} />
        ) : (
          <div style={css("position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:16px")}>
            <span style={css("font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:11px;letter-spacing:.12em;color:#9a8c78;text-align:center;text-transform:uppercase")}>{item.categoryName}</span>
          </div>
        )}
        {item.condition && (
          <div style={css("position:absolute;top:9px;left:9px;background:rgba(255,255,255,.95);color:var(--ink);padding:3px 8px;border-radius:20px;font-size:10px;font-weight:700;box-shadow:0 1px 4px rgba(0,0,0,.1)")}>{item.condition}</div>
        )}
        {item.savingsPct ? (
          <div style={css("position:absolute;top:9px;right:9px;background:var(--green);color:#fff;padding:3px 8px;border-radius:20px;font-size:10px;font-weight:800;box-shadow:0 1px 4px rgba(0,0,0,.12)")}>Save {item.savingsPct}%</div>
        ) : null}
      </div>
      <div style={css("padding:10px 11px 11px")}>
        <div style={css("font-family:'Reckless','Newsreader',serif;font-size:13px;font-weight:500;line-height:1.28;height:33px;overflow:hidden;text-wrap:pretty")}>{item.title}</div>
        {item.location && (
          <div style={css("display:flex;align-items:center;gap:4px;font-size:10.5px;color:var(--muted);margin-top:5px")}>
            <Pin size={12} />{item.location}
          </div>
        )}
        <div style={css("display:flex;align-items:baseline;gap:7px;margin-top:5px")}>
          <span style={css("font-size:15px;font-weight:800;letter-spacing:-.3px")}>{formatPrice(item.priceCents)}</span>
          {item.retailCents ? <span style={css("font-size:11px;color:var(--muted);text-decoration:line-through")}>{formatPrice(item.retailCents)}</span> : null}
        </div>
      </div>
    </Hoverable>
  );
}

/** Loading placeholder that matches the card footprint 1:1. */
export function SearchCardSkeleton() {
  return (
    <div style={css("background:var(--paper);border:1px solid var(--line);border-radius:12px;overflow:hidden")}>
      <div style={css("aspect-ratio:4/3;background:repeating-linear-gradient(135deg,#EDE4D6 0 15px,#E5DACA 15px 30px);opacity:.55")} />
      <div style={css("padding:11px")}>
        <div style={css("height:11px;border-radius:5px;background:var(--putty);margin-bottom:7px")} />
        <div style={css("height:11px;width:60%;border-radius:5px;background:var(--putty);margin-bottom:10px")} />
        <div style={css("height:14px;width:40%;border-radius:5px;background:var(--line)")} />
      </div>
    </div>
  );
}
