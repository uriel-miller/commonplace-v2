"use client";

import { useEffect, useState } from "react";
import { css, sx, Hoverable } from "@/lib/design/css";
import { fetchListings } from "@/lib/clientApi";
import { formatPrice, type Listing } from "@/lib/listing";
import { useCart } from "@/components/cart/CartProvider";
import { ProductExtras } from "./ProductExtras";

/**
 * ProductPage — a faithful port of the live trycommonplace.com product page.
 *
 * Layout (captured from the live Shoptimizer product template):
 *   breadcrumb → [gallery | purchase panel] → description → "Customers also
 *   bought" → "Buying used, finally done right." (the 4-step reassurance strip).
 *
 * The purchase panel reproduces the live surfaces 1:1: price + retail strike +
 * savings, the "$X more off waiting in cart" teaser, the Pay-$1-upfront model,
 * Add to cart (plum pill), the Request-this-item flow, Make an offer, the
 * HSA/FSA button, payment badges, delivery ETA + Edit zip, and the four pastel
 * benefit tiles.
 *
 * Robust by construction: missing images, retail, rating, or related data all
 * degrade gracefully — nothing here throws to the shopper.
 */

const PLUM = "#630E3D";

export interface ProductPageProps {
  item: Listing;
  onBack: () => void;
  onOpenCategory: (slug: string, name: string) => void;
  onMakeOffer: () => void;
  onOpenProduct?: (item: Listing) => void;
  onRequestItem?: () => void;
  onNotify?: () => void;
  onPlayVideo?: (id: string) => void;
}

/* pastel benefit tiles (live order + tints) */
const BENEFITS: readonly [string, string, string][] = [
  ["FREE delivery & install", "var(--blueBg)", "var(--blueInk)"],
  ["Inspect upon delivery", "#FCE3DD", "var(--maroon)"],
  ["2 month warranty included", "var(--yellowBg)", "var(--gold)"],
  ["Verified sellers", "#efe7f3", "var(--purple)"],
];

const STEPS: readonly [string, string][] = [
  ["Buy with $1", "Reserve anything for a single dollar — no risky meetups."],
  ["We bring it inside", "White-glove delivery, right to the room you choose."],
  ["Inspect, then pay", "You only pay the balance once you've checked it out."],
  ["Peace of mind, covered", "Every order includes a 2-month warranty, free."],
];

/* deterministic-enough delivery ETA (client runtime) */
function deliveryEta(): { order: string; receive: string } {
  try {
    const now = new Date();
    const recv = new Date(now.getTime());
    recv.setDate(recv.getDate() + 4);
    const wd = recv.toLocaleDateString("en-US", { weekday: "long" });
    return { order: "today", receive: wd };
  } catch {
    return { order: "today", receive: "this week" };
  }
}

function Stars({ rating }: { rating: number }) {
  const r = Number.isFinite(rating) && rating > 0 ? rating : 5;
  return (
    <span style={css("display:inline-flex;align-items:center;gap:3px")}>
      <span style={css("display:inline-flex")}>
        {[0, 1, 2, 3, 4].map((i) => (
          <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill={i < Math.round(r) ? "#E9B355" : "#e5ded2"} style={css("display:block")}>
            <path d="M12 2l3 6.9 7.5.6-5.7 4.9 1.8 7.3L12 17.9 5.4 21.7l1.8-7.3L1.5 9.5 9 8.9 12 2z" />
          </svg>
        ))}
      </span>
      <span style={css("font-size:12.5px;font-weight:700;color:var(--ink);margin-left:3px")}>{r.toFixed(1)}</span>
    </span>
  );
}

/* --------------------------------- related card --------------------------------- */
function RelatedCard({ it, onOpen }: { it: Listing; onOpen?: () => void }) {
  return (
    <Hoverable as="div" onClick={onOpen} styles="flex:0 0 auto;width:210px;cursor:pointer;background:var(--paper);border:1px solid var(--line);border-radius:14px;overflow:hidden" hover="box-shadow:0 8px 24px rgba(60,10,35,.1);transform:translateY(-2px)">
      <div style={css("width:100%;height:150px;background:repeating-linear-gradient(135deg,#EDE4D6 0 12px,#E5DACA 12px 24px);position:relative")}>
        {it.images?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={it.images[0]} alt="" loading="lazy" style={css("position:absolute;inset:0;width:100%;height:100%;object-fit:cover")} />
        ) : (
          <span style={css("position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:10px;letter-spacing:.12em;color:#9a8c78;text-transform:uppercase;text-align:center;padding:10px")}>{it.categoryName}</span>
        )}
      </div>
      <div style={css("padding:11px 13px 14px")}>
        <div style={css("font-size:13px;font-weight:600;color:var(--ink);line-height:1.35;height:36px;overflow:hidden")}>{it.title}</div>
        <div style={css("font-size:15px;font-weight:800;color:var(--ink);margin-top:6px")}>{formatPrice(it.priceCents)}</div>
      </div>
    </Hoverable>
  );
}

/* ================================================================== */
export function ProductPage({ item, onBack, onOpenCategory, onMakeOffer, onOpenProduct, onRequestItem, onNotify, onPlayVideo }: ProductPageProps) {
  const { add } = useCart();
  const [imgIdx, setImgIdx] = useState(0);
  const [wish, setWish] = useState(false);
  const [inCart, setInCart] = useState(false);
  const [related, setRelated] = useState<Listing[] | null>(null);

  const images = Array.isArray(item.images) ? item.images.filter(Boolean) : [];
  const hasImg = images.length > 0;
  const retail = typeof item.retailCents === "number" && item.retailCents > item.priceCents ? item.retailCents : null;
  const savings = retail ? retail - item.priceCents : 0;
  const savePct = item.savingsPct ?? (retail ? Math.round((savings / retail) * 100) : null);
  const eta = deliveryEta();
  const city = (item.location || "").split(",")[0] || "your area";

  useEffect(() => { setImgIdx(0); setInCart(false); }, [item.id]);

  useEffect(() => {
    let alive = true;
    setRelated(null);
    fetchListings({ category: item.categorySlug, perPage: 5, orderby: "recommended" })
      .then((d) => { if (alive) setRelated(d.items.filter((x) => x.id !== item.id).slice(0, 4)); })
      .catch(() => { if (alive) setRelated([]); });
    return () => { alive = false; };
  }, [item.id, item.categorySlug]);

  function addToCart() {
    add(item);
    setInCart(true);
  }

  return (
    <div style={css("max-width:1340px;margin:0 auto;padding:4px 22px 80px")}>
      {/* Breadcrumb */}
      <div style={css("display:flex;align-items:center;gap:7px;font-size:12.5px;color:var(--muted);margin-bottom:18px;flex-wrap:wrap")}>
        <Hoverable as="span" onClick={onBack} styles="cursor:pointer" hover="color:var(--ink)">Home</Hoverable>
        <span>/</span>
        <Hoverable as="span" onClick={() => onOpenCategory(item.categorySlug, item.categoryName)} styles="cursor:pointer" hover="color:var(--ink)">{item.categoryName}</Hoverable>
        <span>/</span>
        <span style={css("color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:360px")}>{item.title}</span>
      </div>

      {/* Gallery + Panel */}
      <div style={css("display:grid;grid-template-columns:minmax(0,1fr) 440px;gap:40px;align-items:start")} data-pp-grid>
        {/* ---------------- Gallery ---------------- */}
        <div>
          <div style={css("position:relative;width:100%;aspect-ratio:1/1;border-radius:16px;overflow:hidden;background:repeating-linear-gradient(135deg,#EDE4D6 0 16px,#E5DACA 16px 32px)")}>
            {hasImg ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={images[imgIdx]} alt={item.title} style={css("position:absolute;inset:0;width:100%;height:100%;object-fit:cover")} />
            ) : (
              <span style={css("position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:13px;letter-spacing:.14em;color:#9a8c78;text-transform:uppercase")}>{item.categoryName}</span>
            )}

            {/* Save% badge */}
            {savePct ? (
              <span style={css("position:absolute;top:14px;left:14px;background:#3B7A57;color:#fff;font-size:12px;font-weight:800;padding:5px 11px;border-radius:20px")}>Save {savePct}%</span>
            ) : null}

            {/* Wishlist */}
            <span onClick={() => setWish((w) => { const nv = !w; if (nv) onNotify?.(); return nv; })} style={css("position:absolute;top:12px;right:12px;width:38px;height:38px;border-radius:50%;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.15);display:flex;align-items:center;justify-content:center;cursor:pointer")}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill={wish ? PLUM : "none"} stroke={wish ? PLUM : "#666"} strokeWidth={2}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>
            </span>

            {/* AI Enhanced */}
            <span style={css("position:absolute;bottom:12px;left:12px;background:rgba(25,12,18,.7);color:#fff;font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px;display:flex;align-items:center;gap:4px")}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff"><path d="M12 2l1.9 5.1L19 9l-5.1 1.9L12 16l-1.9-5.1L5 9l5.1-1.9L12 2z" /></svg>AI Enhanced
            </span>

            {/* Arrows */}
            {images.length > 1 && (
              <>
                <span onClick={() => setImgIdx((i) => (i - 1 + images.length) % images.length)} style={css("position:absolute;top:50%;left:12px;transform:translateY(-50%);width:36px;height:36px;border-radius:50%;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.15);display:flex;align-items:center;justify-content:center;cursor:pointer")}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="m15 6-6 6 6 6" /></svg>
                </span>
                <span onClick={() => setImgIdx((i) => (i + 1) % images.length)} style={css("position:absolute;top:50%;right:12px;transform:translateY(-50%);width:36px;height:36px;border-radius:50%;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.15);display:flex;align-items:center;justify-content:center;cursor:pointer")}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
                </span>
              </>
            )}
          </div>

          {/* Thumbnails */}
          {images.length > 1 && (
            <div style={css("display:flex;gap:9px;margin-top:12px;flex-wrap:wrap")}>
              {images.slice(0, 8).map((src, i) => (
                <div key={i} onClick={() => setImgIdx(i)} style={sx("width:64px;height:64px;border-radius:9px;overflow:hidden;cursor:pointer", i === imgIdx ? { border: `2px solid ${PLUM}` } : { border: "1px solid var(--line)" })}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" loading="lazy" style={css("width:100%;height:100%;object-fit:cover")} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ---------------- Purchase panel ---------------- */}
        <div>
          {/* location + rating */}
          <div style={css("display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px")}>
            {item.location ? (
              <span style={css("display:flex;align-items:center;gap:4px;font-size:12.5px;color:var(--muted)")}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></svg>
                {item.location}
              </span>
            ) : <span />}
            <Stars rating={item.rating} />
          </div>

          {/* title */}
          <h1 style={css("font-family:'Reckless','Newsreader',serif;font-size:23px;font-weight:500;line-height:1.25;letter-spacing:-.2px;color:var(--ink);margin-bottom:16px")}>{item.title}</h1>

          {/* price card */}
          <div style={css("border:1px solid var(--line);border-radius:14px;padding:16px;margin-bottom:14px")}>
            <div style={css("display:flex;align-items:baseline;gap:10px")}>
              <span style={css("font-size:30px;font-weight:800;letter-spacing:-.5px;color:var(--ink)")}>{formatPrice(item.priceCents)}</span>
              {retail && <span style={css("font-size:15px;color:var(--muted);text-decoration:line-through")}>Retail {formatPrice(retail)}</span>}
            </div>
            {savings > 0 && (
              <div style={css("font-size:13px;color:var(--green);font-weight:700;margin-top:4px")}>You save {formatPrice(savings)} <span style={css("color:var(--muted);font-weight:500")}>· Up to 80% off across Commonplace</span></div>
            )}
            {/* private-offer teaser */}
            <div style={css("margin-top:12px;background:#FDF0E7;border-radius:10px;padding:10px 12px;display:flex;align-items:center;gap:9px")}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#E9B355"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" /></svg>
              <div style={css("font-size:12.5px;color:var(--ink);line-height:1.4")}><b>Up to $150 more off</b> waiting in cart<div style={css("color:var(--muted)")}>Add to cart to unlock your private offer</div></div>
            </div>
          </div>

          {/* $1 model */}
          <div style={css("display:flex;align-items:center;gap:8px;margin-bottom:12px")}>
            <span style={sx("font-size:12px;font-weight:800;color:#fff;padding:4px 11px;border-radius:20px", { background: PLUM })}>Pay $1 upfront</span>
            <span style={css("font-size:13px;color:var(--muted)")}>rest on delivery.</span>
          </div>

          {/* Add to cart */}
          <Hoverable as="button" onClick={addToCart} styles={`width:100%;background:${PLUM};color:#fff;border:none;border-radius:999px;padding:15px;font-size:16px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:9px;margin-bottom:10px`} hover="filter:brightness(1.08)">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.6 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" /></svg>
            {inCart ? "Added to cart ✓" : "Add to cart"}
          </Hoverable>

          {/* Request this item */}
          <Hoverable as="button" onClick={onRequestItem} styles="width:100%;background:var(--maroon2);color:#fff;border:none;border-radius:999px;padding:13px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit;margin-bottom:6px" hover="filter:brightness(1.08)">Request this item</Hoverable>
          <div style={css("text-align:center;font-size:12px;color:var(--muted);margin-bottom:12px")}>Want one closer or cheaper? Tell us and we&apos;ll find it for you.</div>

          {/* inspection + make offer */}
          <div style={css("display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px")}>
            <span style={css("display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--muted)")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth={2}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>
              In-home inspection at delivery.
            </span>
            <Hoverable as="span" onClick={onMakeOffer} styles="font-size:13px;font-weight:700;color:var(--blueInk);cursor:pointer" hover="text-decoration:underline">Make an offer</Hoverable>
          </div>

          {/* HSA/FSA */}
          <Hoverable as="button" styles="width:100%;background:#111;color:#fff;border:none;border-radius:999px;padding:13px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;margin-bottom:14px" hover="filter:brightness(1.5)">Apply for HSA/FSA Reimbursement →</Hoverable>

          {/* payment badges */}
          <div style={css("display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;margin-bottom:14px;opacity:.9")}>
            <span style={css("font-size:11px;font-weight:800;color:#1a1f71")}>VISA</span>
            <span style={css("font-size:11px;font-weight:800;color:#eb001b")}>MC</span>
            <span style={css("font-size:11px;font-weight:800;color:#ff6000")}>DISC</span>
            <span style={css("font-size:11px;font-weight:800;color:#006fcf")}>AMEX</span>
            <span style={css("font-size:11px;font-weight:800;color:#003087")}>PayPal</span>
            <span style={css("font-size:11px;font-weight:800;color:#111")}>Pay</span>
            <span style={css("font-size:11px;font-weight:800;color:#3d95ce")}>venmo</span>
            <span style={css("font-size:11px;font-weight:800;color:#ffb3c7")}>Klarna</span>
          </div>

          {/* delivery ETA */}
          <div style={css("background:var(--blueBg);border-radius:10px;padding:11px 13px;display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px")}>
            <span style={css("display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--blueInk)")}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}><rect x="1" y="6" width="15" height="11" rx="1.5" /><path d="M16 9h4l3 3v5h-7" /><circle cx="6" cy="18" r="2" /><circle cx="19" cy="18" r="2" /></svg>
              Order by <b>{eta.order}</b>, Receive by <b>{eta.receive}</b>.
            </span>
            <span style={css("font-size:12px;font-weight:700;color:var(--blueInk);text-decoration:underline;cursor:pointer")}>Edit zip</span>
          </div>
          <div style={css("font-size:12px;color:var(--muted);margin-bottom:16px")}>📍 Pickup in <b>{city}</b>. Delivery available nationwide.</div>

          {/* benefit tiles */}
          <div style={css("display:grid;grid-template-columns:1fr 1fr;gap:9px")}>
            {BENEFITS.map(([label, bg, fg]) => (
              <div key={label} style={sx("display:flex;align-items:center;gap:8px;border-radius:10px;padding:11px 12px", { background: bg })}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth={2.6}><path d="M20 6 9 17l-5-5" /></svg>
                <span style={css("font-size:12px;font-weight:600;color:var(--ink);line-height:1.2")}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Description */}
      {item.description && item.description.length > 0 && (
        <section style={css("margin-top:44px;max-width:760px")}>
          <h2 style={css("font-family:'Reckless','Newsreader',serif;font-size:22px;font-weight:600;margin-bottom:12px")}>Details</h2>
          {item.description.map((p, i) => (
            <p key={i} style={css("font-size:14.5px;color:var(--ink);line-height:1.6;margin-bottom:12px")}>{p}</p>
          ))}
          {(item.dimensions || item.weight) && (
            <div style={css("display:flex;gap:26px;margin-top:6px;font-size:13px;color:var(--muted)")}>
              {item.dimensions && <div><b style={css("color:var(--ink)")}>Dimensions:</b> {item.dimensions}</div>}
              {item.weight && <div><b style={css("color:var(--ink)")}>Weight:</b> {item.weight}</div>}
            </div>
          )}
        </section>
      )}

      {/* Customers also bought */}
      {related && related.length > 0 && (
        <section style={css("margin-top:48px")}>
          <h2 style={css("font-family:'Reckless','Newsreader',serif;font-size:24px;font-weight:600;margin-bottom:18px")}>Customers also bought</h2>
          <div style={css("display:flex;gap:16px;overflow-x:auto;padding-bottom:6px")}>
            {related.map((it) => (
              <RelatedCard key={it.id} it={it} onOpen={onOpenProduct ? () => onOpenProduct(it) : undefined} />
            ))}
          </div>
        </section>
      )}

      {/* Buying used, finally done right */}
      <section style={css("margin-top:52px;background:#F7F1E8;border-radius:20px;padding:34px 30px")}>
        <h2 style={css("font-family:'Reckless','Newsreader',serif;font-size:26px;font-weight:500;text-align:center;margin-bottom:26px")}>Buying used, finally done right.</h2>
        <div style={css("display:grid;grid-template-columns:repeat(4,1fr);gap:20px")} data-pp-steps>
          {STEPS.map(([title, blurb], i) => (
            <div key={title} style={css("text-align:center")}>
              <div style={sx("width:44px;height:44px;margin:0 auto 12px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;color:#fff", { background: PLUM })}>{i + 1}</div>
              <div style={css("font-size:15px;font-weight:700;color:var(--ink);margin-bottom:5px")}>{title}</div>
              <div style={css("font-size:13px;color:var(--muted);line-height:1.5")}>{blurb}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How Commonplace Compares · By the numbers · What buyers say · Questions · Why Commonplace · Ask the Seller */}
      <ProductExtras item={item} onPlayVideo={onPlayVideo} />

      <style>{"@media(max-width:860px){[data-pp-grid]{grid-template-columns:1fr!important;gap:24px!important}[data-pp-steps]{grid-template-columns:1fr 1fr!important}}"}</style>
    </div>
  );
}

export default ProductPage;
