"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { css, sx, Hoverable } from "@/lib/design/css";
import { fetchListings } from "@/lib/clientApi";
import { formatPrice, type Listing } from "@/lib/listing";
import { useCart } from "@/components/cart/CartProvider";
import { addonsForCategories, addonToListing } from "@/lib/addons";
import { AddonIcon } from "@/components/cart/AddonIcon";
import { warrantyTotalCents, warrantyRenewalMonthlyCents } from "@/lib/warranty";
import { ProductExtras } from "./ProductExtras";
import { PaymentBadges } from "@/components/marketplace/PaymentBadges";

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
  ["FREE delivery & install", "#D6E8FB", "var(--blueInk)"],
  ["Inspect upon delivery", "#FBD6CC", "var(--maroon)"],
  ["2 month warranty included", "#F6E6AE", "#A5730F"],
  ["Verified sellers", "#E7D6F3", "#6C4CB3"],
];

// "Learn about Commonplace" cards — [title, subtitle, accent, stripe1, stripe2].
const LEARN: readonly [string, string, string, string, string][] = [
  ["What is Commonplace", "The whole process, start to finish.", "var(--maroon)", "#efe4d5", "#e6dac9"],
  ["How Delivery Works", "Pickup, transport, and setup.", "var(--blue)", "#e3ebf5", "#d7e2f0"],
  ["How Offers Work", "Make an offer and bidding.", "var(--gold)", "#f3ead2", "#ece0c4"],
  ["How Pickup Works", "Inspection to payment.", "var(--red)", "#f3e0da", "#ecd3cb"],
];

// [title, blurb, badge bg, badge number color] — matches the live "How it works" strip exactly.
const STEPS: readonly [string, string, string, string][] = [
  ["Buy with $1", "Reserve any item with a dollar. You'll only be charged the full amount at delivery.", "var(--maroon)", "#fff"],
  ["We bring it inside", "Delivery and set up in the room of your choice. No schlepping, no phoning a friend for a favor.", "var(--yellow)", "#6B4E0F"],
  ["Inspect, then pay", "Test it out. Sit on it. Open every drawer. Charge the rest only after you say yes.", "var(--blue)", "#1E3E63"],
  ["Peace of mind, covered", "Dedicated human support on every order. Twelve-month warranty available.", "var(--purple)", "#fff"],
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
  const [showStickyCta, setShowStickyCta] = useState(false); // sticky bottom Add-to-cart (Quince-style)
  const ctaRef = useRef<HTMLDivElement>(null);

  // Show the sticky bar once the main Add-to-cart button scrolls out of view.
  useEffect(() => {
    const el = ctaRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setShowStickyCta(!e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const images = Array.isArray(item.images) ? item.images.filter(Boolean) : [];
  const hasImg = images.length > 0;
  const retail = typeof item.retailCents === "number" && item.retailCents > item.priceCents ? item.retailCents : null;
  // Available listings are buyable (Add to cart). Sold / Google-Shopping catalog
  // items are notify-only (Request this item) — never both on the same product.
  const available = (item as { available?: boolean; sold?: boolean }).available !== false
    && (item as { sold?: boolean }).sold !== true
    && item.priceCents > 0;
  const savings = retail ? retail - item.priceCents : 0;
  const savePct = item.savingsPct ?? (retail ? Math.round((savings / retail) * 100) : null);
  const eta = deliveryEta();
  const city = (item.location || "").split(",")[0] || "your area";

  useEffect(() => { setImgIdx(0); setInCart(false); }, [item.id]);

  const relPage = useRef(1);
  const relMore = useRef(true);
  const relLoading = useRef(false);
  const railRef = useRef<HTMLDivElement>(null);
  const REL_PER = 12;

  useEffect(() => {
    let alive = true;
    setRelated(null);
    relPage.current = 1; relMore.current = true;
    fetchListings({ category: item.categorySlug, perPage: REL_PER, page: 1, orderby: "recommended" })
      .then((d) => { if (alive) { setRelated(d.items.filter((x) => x.id !== item.id)); relMore.current = d.items.length >= REL_PER; } })
      .catch(() => { if (alive) setRelated([]); });
    return () => { alive = false; };
  }, [item.id, item.categorySlug]);

  // Endless horizontal scroll — load the next page as the rail nears its end.
  const loadMoreRelated = useCallback(() => {
    if (relLoading.current || !relMore.current) return;
    relLoading.current = true;
    const next = relPage.current + 1;
    fetchListings({ category: item.categorySlug, perPage: REL_PER, page: next, orderby: "recommended" })
      .then((d) => {
        setRelated((prev) => {
          const cur = prev ?? [];
          const seen = new Set(cur.map((x) => x.id));
          return [...cur, ...d.items.filter((x) => x.id !== item.id && !seen.has(x.id))];
        });
        relPage.current = next;
        relMore.current = d.items.length >= REL_PER;
        relLoading.current = false;
      })
      .catch(() => { relLoading.current = false; });
  }, [item.categorySlug, item.id]);

  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    const onScroll = () => { if (el.scrollWidth - el.scrollLeft - el.clientWidth < 600) loadMoreRelated(); };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [loadMoreRelated, related]);

  function addToCart() {
    add(item);
    setInCart(true);
  }

  return (
    <div style={css("max-width:1340px;margin:0 auto;padding:4px 22px 80px")}>
      {/* Sticky bottom Add-to-cart bar (appears once the main button scrolls away) */}
      {available && showStickyCta && (
        <div style={css("position:fixed;left:0;right:0;bottom:0;z-index:150;background:var(--paper);border-top:1px solid var(--line);box-shadow:0 -6px 24px rgba(60,10,35,.12);padding:11px 84px 11px 20px;display:flex;align-items:center;gap:14px")}>
          <div style={css("width:44px;height:44px;flex:0 0 auto;border-radius:9px;overflow:hidden;background:repeating-linear-gradient(135deg,#EDE4D6 0 10px,#E5DACA 10px 20px)")}>
            {hasImg && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={images[0]} alt="" style={css("width:100%;height:100%;object-fit:cover")} />
            )}
          </div>
          <div onClick={() => { try { document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" }); } catch { /* ignore */ } }} style={css("flex:1;min-width:0;cursor:pointer")}>
            <div style={css("font-size:13.5px;font-weight:600;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{item.title}</div>
            <div style={css("font-size:15px;font-weight:800;color:var(--ink)")}>{formatPrice(item.priceCents)}</div>
          </div>
          <Hoverable as="button" onClick={addToCart} styles={`flex:0 0 auto;background:${PLUM};color:#fff;border:none;border-radius:999px;padding:12px 26px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap`} hover="filter:brightness(1.08)">
            {inCart ? "Added ✓" : "Add to cart"}
          </Hoverable>
        </div>
      )}
      {/* Breadcrumb */}
      <div style={css("display:flex;align-items:center;gap:7px;font-size:12.5px;color:var(--muted);margin-bottom:18px;flex-wrap:wrap")}>
        <Hoverable as="span" onClick={onBack} styles="cursor:pointer" hover="color:var(--ink)">Home</Hoverable>
        <span>/</span>
        <Hoverable as="span" onClick={() => onOpenCategory(item.categorySlug, item.categoryName)} styles="cursor:pointer;color:var(--blueInk);font-weight:600" hover="text-decoration:underline">{item.categoryName}</Hoverable>
        <span>/</span>
        <span style={css("color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:360px")}>{item.title}</span>
      </div>

      {/* Gallery ~60% on the left, details ~40% on the right */}
      <div style={css("display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:30px;align-items:start")} data-pp-grid>
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
          <h1 style={css("font-family:'Reckless','Newsreader',serif;font-size:23px;font-weight:500;line-height:1.25;letter-spacing:-.2px;color:var(--ink);margin-bottom:10px")}>{item.title}</h1>

          {/* price card */}
          <div style={css("border:1px solid var(--line);border-radius:14px;padding:12px 15px;margin-bottom:9px")}>
            <div style={css("display:flex;align-items:baseline;gap:10px")}>
              <span style={css("font-size:30px;font-weight:800;letter-spacing:-.5px;color:var(--ink)")}>{formatPrice(item.priceCents)}</span>
              {retail && <span style={css("font-size:15px;color:var(--muted);text-decoration:line-through")}>Retail {formatPrice(retail)}</span>}
            </div>
            {savings > 0 && (
              <div style={css("font-size:13px;color:var(--green);font-weight:700;margin-top:4px")}>You save {formatPrice(savings)} <span style={css("color:var(--muted);font-weight:500")}>· Up to 80% off across Commonplace</span></div>
            )}
            {/* private-offer teaser */}
            <div style={css("margin-top:10px;background:#FDF0E7;border-radius:10px;padding:8px 11px;display:flex;align-items:center;gap:9px")}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#E9B355"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" /></svg>
              <div style={css("font-size:12.5px;color:var(--ink);line-height:1.4")}><b>Up to $150 more off</b> waiting in cart<div style={css("color:var(--muted)")}>Add to cart to unlock your private offer</div></div>
            </div>
          </div>

          {/* $1 model */}
          <div style={css("display:flex;align-items:center;gap:8px;margin-bottom:9px")}>
            <span style={sx("font-size:12px;font-weight:800;color:#fff;padding:4px 11px;border-radius:20px", { background: PLUM })}>Pay $1 upfront</span>
            <span style={css("font-size:13px;color:var(--muted)")}>rest on delivery.</span>
          </div>

          {available ? (
            /* Available → Add to cart (buyable) */
            <Hoverable as="button" onClick={addToCart} styles={`width:100%;background:${PLUM};color:#fff;border:none;border-radius:999px;padding:15px;font-size:16px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:9px;margin-bottom:10px`} hover="filter:brightness(1.08)">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.6 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" /></svg>
              {inCart ? "Added to cart ✓" : "Add to cart"}
            </Hoverable>
          ) : null}
          {/* Sentinel: when this leaves the viewport, the sticky bottom bar appears. */}
          {available && <div ref={ctaRef} style={css("height:1px")} />}
          {!available && (
            /* Sold / catalog → Request-this-item (notify only) */
            <>
              <Hoverable as="button" onClick={onRequestItem} styles="width:100%;background:var(--maroon2);color:#fff;border:none;border-radius:999px;padding:15px;font-size:16px;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:6px" hover="filter:brightness(1.08)">Request this item</Hoverable>
              <div style={css("text-align:center;font-size:12px;color:var(--muted);margin-bottom:12px")}>This one&apos;s no longer available — tell us and we&apos;ll find you a similar one, delivered.</div>
            </>
          )}

          {/* inspection + make offer */}
          <div style={css("display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px")}>
            <span style={css("display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--muted)")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth={2}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>
              In-home inspection at delivery.
            </span>
            <Hoverable as="span" onClick={onMakeOffer} styles="font-size:13px;font-weight:700;color:var(--blueInk);cursor:pointer" hover="text-decoration:underline">Make an offer</Hoverable>
          </div>

          {/* HSA/FSA */}
          <Hoverable as="button" styles="width:100%;background:#111;color:#fff;border:none;border-radius:999px;padding:11px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;margin-bottom:8px" hover="filter:brightness(1.5)">Apply for HSA/FSA Reimbursement →</Hoverable>

          {/* payment badges */}
          <div style={css("margin-bottom:8px")}>
            <PaymentBadges />
          </div>

          {/* delivery ETA */}
          <div style={css("background:var(--blueBg);border-radius:10px;padding:11px 13px;display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px")}>
            <span style={css("display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--blueInk)")}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} style={css("flex:0 0 auto")}><rect x="1" y="6" width="15" height="11" rx="1.5" /><path d="M16 9h4l3 3v5h-7" /><circle cx="6" cy="18" r="2" /><circle cx="19" cy="18" r="2" /></svg>
              <span>Order by <b>{eta.order}</b>, Receive by <b>{eta.receive}</b>.</span>
            </span>
            <span style={css("font-size:12px;font-weight:700;color:var(--blueInk);text-decoration:underline;cursor:pointer")}>Edit zip</span>
          </div>
          <div style={css("font-size:12px;color:var(--muted);margin-bottom:8px")}>📍 Pickup in <b>{city}</b>. Delivery available nationwide.</div>

          {/* benefit tiles */}
          <div style={css("display:grid;grid-template-columns:1fr 1fr;gap:8px")}>
            {BENEFITS.map(([label, bg, fg]) => (
              <div key={label} style={sx("display:flex;align-items:center;gap:8px;border-radius:10px;padding:9px 11px", { background: bg })}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth={2.6}><path d="M20 6 9 17l-5-5" /></svg>
                <span style={css("font-size:12px;font-weight:600;color:var(--ink);line-height:1.2")}>{label}</span>
              </div>
            ))}
          </div>

          {/* Spec table — SKU / Condition / Listing ID */}
          <div style={css("margin-top:10px")}>
            {[
              ["SKU", item.sku || "—"],
              ["Condition", item.condition ? item.condition.replace(/\b\w/g, (c) => c.toUpperCase()) : "—"],
              ["Listing ID", `CP-${item.id}`],
            ].map(([label, value]) => (
              <div key={label} style={css("display:flex;gap:20px;padding:6px 2px;border-bottom:1px solid var(--line);font-size:13.5px")}>
                <span style={css("width:110px;flex:0 0 auto;color:var(--muted);font-weight:600")}>{label}</span>
                <span style={css("color:var(--ink)")}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Description */}
      {item.description && item.description.length > 0 && (
        <section style={css("margin-top:44px;max-width:760px")}>
          <h2 style={css("font-family:'Reckless','Newsreader',serif;font-size:22px;font-weight:600;margin-bottom:12px;border-left:3px solid var(--maroon);padding-left:11px")}>Details</h2>
          {item.description.map((p, i) => (
            <p key={i} style={css("font-size:14.5px;color:var(--ink);line-height:1.6;margin-bottom:12px")}>{p}</p>
          ))}
          {(item.dimensions || item.weight || item.sku) && (
            <div style={css("display:flex;gap:26px;margin-top:6px;font-size:13px;color:var(--muted);flex-wrap:wrap")}>
              {item.dimensions && <div><b style={css("color:var(--ink)")}>Dimensions:</b> {item.dimensions}</div>}
              {item.weight && <div><b style={css("color:var(--ink)")}>Weight:</b> {item.weight}</div>}
              {item.sku && <div><b style={css("color:var(--ink)")}>SKU:</b> {item.sku}</div>}
            </div>
          )}
        </section>
      )}

      {/* Customers also bought */}
      {related && related.length > 0 && (
        <section style={css("margin-top:48px")}>
          <h2 style={css("font-family:'Reckless','Newsreader',serif;font-size:24px;font-weight:600;margin-bottom:18px;border-left:3px solid var(--blueInk);padding-left:11px")}>Customers also bought</h2>
          <div ref={railRef} style={css("display:flex;gap:16px;overflow-x:auto;padding-bottom:6px")}>
            {related.map((it) => (
              <RelatedCard key={it.id} it={it} onOpen={onOpenProduct ? () => onOpenProduct(it) : undefined} />
            ))}
          </div>
        </section>
      )}

      {/* Per-category add-ons (protection + accessories) — also offered in cart */}
      <ProductAddons item={item} />

      {/* How it works — "Buying used, finally done right." */}
      <section style={css("margin-top:52px")}>
        <div style={css("font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--maroon);margin-bottom:10px")}>How it works</div>
        <h2 style={css("font-family:'Reckless','Newsreader',serif;font-size:30px;font-weight:500;color:var(--ink);margin-bottom:8px")}>Buying used, finally done right.</h2>
        <p style={css("font-size:14.5px;color:var(--muted);margin-bottom:24px")}>No flaky meet-ups, no &ldquo;as-is&rdquo; surprises. Four steps, and a real human at every one.</p>
        <div style={css("display:grid;grid-template-columns:repeat(4,1fr);gap:16px")} data-pp-steps>
          {STEPS.map(([title, blurb, color, numColor], i) => (
            <div key={title} style={css("background:#FDF7F2;border-radius:16px;padding:20px 18px")}>
              <div style={sx("width:38px;height:38px;margin-bottom:16px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px", { background: color, color: numColor })}>{i + 1}</div>
              <div style={css("font-family:'Reckless','Newsreader',serif;font-size:19px;font-weight:600;color:var(--ink);margin-bottom:7px;letter-spacing:-.01em")}>{title}</div>
              <div style={css("font-size:13.5px;color:var(--muted);line-height:1.55")}>{blurb}</div>
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

/* ---------------- Per-category add-ons on the product page ---------------- */
function ProductAddons({ item }: { item: Listing }) {
  const { add, remove, items } = useCart();
  const [wTerm, setWTerm] = useState<6 | 12 | 18>(12);
  const [autoRenew, setAutoRenew] = useState(false);
  const [shoeSize, setShoeSize] = useState(""); // Peloton shoes ask for a size on add
  let raw: ReturnType<typeof addonsForCategories> = [];
  try { raw = addonsForCategories([`${item.categorySlug ?? ""} ${item.categoryName ?? ""}`]); } catch { raw = []; }

  const wMo = warrantyRenewalMonthlyCents(item.priceCents); // renewal = 6-month per-month rate
  const others = raw.filter((a) => a.kind !== "warranty");
  const hasWarranty = raw.some((a) => a.kind === "warranty");
  const inCart = new Set(items.map((i) => i.listing.id));
  const warrantyItem = items.find((it) => typeof it.listing.slug === "string" && it.listing.slug.startsWith("war-ext-"));
  if (others.length === 0 && !hasWarranty) return null;

  const kindTile = (kind: string) =>
    kind === "warranty" ? { background: "var(--tint)", color: "var(--maroon)" }
    : kind === "service" ? { background: "var(--greenBg)", color: "var(--green)" }
    : { background: "var(--blueBg)", color: "var(--blueInk)" };

  const termPrice = (t: 6 | 12 | 18) => warrantyTotalCents(item.priceCents, t);
  const buildWarranty = (t: 6 | 12 | 18, renew: boolean) => ({ key: `war-ext-${t}${renew ? "-r" : ""}`, kind: "warranty" as const, title: `${t}-Month Warranty${renew ? " + auto-renew" : ""}`, blurb: renew ? `Prepaid ${t}-month coverage, then ${formatPrice(wMo)}/mo (billed after your term).` : `Prepaid ${t}-month coverage.`, priceCents: termPrice(t) });
  const reAdd = (t: 6 | 12 | 18, renew: boolean) => { if (warrantyItem) { remove(warrantyItem.listing.id); add(addonToListing(buildWarranty(t, renew))); } };
  const pickTerm = (t: 6 | 12 | 18) => { setWTerm(t); reAdd(t, autoRenew); };
  const toggleRenew = () => { const nv = !autoRenew; setAutoRenew(nv); reAdd(wTerm, nv); };
  const toggleWarranty = () => { if (warrantyItem) remove(warrantyItem.listing.id); else add(addonToListing(buildWarranty(wTerm, autoRenew))); };
  const TERMS: [6 | 12 | 18, string][] = [[6, "6 mo"], [12, "12 mo"], [18, "18 mo"]];

  return (
    <section style={css("margin-top:48px;background:var(--paper);border:1px solid var(--line);border-radius:20px;padding:26px 28px")}>
      <h2 style={css("font-family:'Reckless','Newsreader',serif;font-size:22px;font-weight:600;margin-bottom:4px;border-left:3px solid var(--gold);padding-left:11px")}>Complete your setup</h2>
      <p style={css("font-size:13.5px;color:var(--muted);margin-bottom:18px")}>Protection and accessories for your {item.categoryName || "order"} — added at checkout and delivered together.</p>

      {/* Extended warranty with plan-length picker */}
      {hasWarranty && (
        <div style={sx("padding:16px 18px;border-radius:14px;margin-bottom:12px", warrantyItem ? { border: "1.5px solid var(--maroon)", background: "#fbf3f7" } : { border: "1px solid var(--line)", background: "var(--paper)" })}>
          <div style={css("display:flex;align-items:center;gap:12px")}>
            <div style={sx("width:48px;height:48px;flex:0 0 auto;border-radius:11px;display:flex;align-items:center;justify-content:center", kindTile("warranty"))}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>
            </div>
            <div style={css("flex:1;min-width:0")}>
              <div style={css("font-size:16px;font-weight:800;color:var(--ink)")}>Extended Warranty <span style={css("color:var(--maroon)")}>+{formatPrice(termPrice(wTerm))}</span></div>
              <div style={css("font-size:15px;font-weight:500;color:var(--ink);line-height:1.55;margin-top:5px")}>Full parts &amp; labor coverage, prepaid {wTerm} months upfront. Diagnostics, parts and repairs handled by our network — nothing out of pocket while covered.</div>
            </div>
            <Hoverable as="button" onClick={toggleWarranty}
              styles={sx("flex:0 0 auto;border-radius:22px;padding:10px 20px;font-size:14.5px;font-weight:800;cursor:pointer;font-family:inherit", warrantyItem ? { background: "var(--maroon)", color: "#fff", border: "1px solid var(--maroon)" } : { background: "var(--paper)", color: "var(--maroon)", border: "1.5px solid var(--maroon)" })}
              hover={warrantyItem ? "filter:brightness(1.08)" : "background:#fbf3f7"}>
              {warrantyItem ? "✓ Added" : "+ Add"}
            </Hoverable>
          </div>
          {/* Plan-length chips */}
          <div style={css("display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;padding-left:60px")}>
            {TERMS.map(([t, label]) => {
              const on = wTerm === t;
              return (
                <div key={t} onClick={() => pickTerm(t)} style={sx("display:flex;flex-direction:column;align-items:center;gap:2px;padding:9px 16px;border-radius:12px;cursor:pointer;transition:all .14s;min-width:80px", on ? { background: "var(--blueBg)", color: "var(--blueInk)", border: "2px solid var(--blueInk)" } : { background: "var(--paper)", color: "var(--ink)", border: "1px solid var(--line)" })}>
                  <span style={css("font-size:15px;font-weight:800")}>{label}</span>
                  <span style={css("font-size:12.5px;font-weight:600;opacity:.85")}>{formatPrice(termPrice(t))} upfront</span>
                </div>
              );
            })}
          </div>
          {/* Optional month-to-month continuation — opt in now, billed only after the term ends */}
          <div onClick={toggleRenew} role="checkbox" aria-checked={autoRenew} tabIndex={0}
            style={css("display:flex;align-items:flex-start;gap:11px;margin-top:12px;margin-left:60px;padding:12px 14px;border-radius:12px;cursor:pointer;background:var(--putty)")}>
            <div style={sx("width:22px;height:22px;flex:0 0 auto;border-radius:6px;margin-top:1px;display:flex;align-items:center;justify-content:center;transition:all .14s", autoRenew ? { background: "var(--maroon)", border: "1px solid var(--maroon)" } : { background: "var(--paper)", border: "1.5px solid var(--line)" })}>
              {autoRenew && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
            </div>
            <div style={css("font-size:13.5px;color:var(--ink);line-height:1.5")}>
              <b>Continue month-to-month after my term</b> <span style={css("color:var(--muted)")}>(optional)</span> — {formatPrice(wMo)}/mo. Sign up now, first charge only after your {wTerm}-month term expires. Cancel anytime.
            </div>
          </div>
        </div>
      )}

      {/* Services + accessories */}
      <div style={css("display:grid;grid-template-columns:1fr 1fr;gap:12px")} data-pp-addons>
        {others.map((a) => {
          // Peloton shoes must ask for a size before adding to cart.
          const isShoe = a.key === "acc-peloton-shoes" || /\bshoe/i.test(a.title);
          if (isShoe) {
            const shoeItem = items.find((it) => typeof it.listing.slug === "string" && it.listing.slug.startsWith("acc-peloton-shoes"));
            const addShoe = () => { if (!shoeSize) return; add(addonToListing({ ...a, key: `acc-peloton-shoes-eu${shoeSize}`, title: `${a.title} · EU ${shoeSize}` })); setShoeSize(""); };
            const SIZES = ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46", "47"];
            return (
              <div key={a.key} style={sx("display:flex;flex-direction:column;gap:10px;padding:12px;border-radius:14px", shoeItem ? { border: "1.5px solid var(--maroon)", background: "#fbf3f7" } : { border: "1px solid var(--line)", background: "var(--paper)" })}>
                <div style={css("display:flex;align-items:center;gap:12px")}>
                  <AddonIcon title={a.title} kind={a.kind} size={48} image={a.image} />
                  <div style={css("flex:1;min-width:0")}>
                    <div style={css("font-size:13.5px;font-weight:700;color:var(--ink)")}>{a.title} <span style={css("color:var(--muted)")}>+{formatPrice(a.priceCents)}</span></div>
                    <div style={css("font-size:12px;color:var(--muted);line-height:1.35;margin-top:2px")}>{shoeItem ? shoeItem.listing.title : a.blurb}</div>
                  </div>
                  {shoeItem && (
                    <Hoverable as="button" onClick={() => remove(shoeItem.listing.id)} styles={sx("flex:0 0 auto;border-radius:20px;padding:8px 15px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit", { background: "var(--maroon)", color: "#fff", border: "1px solid var(--maroon)" })} hover="filter:brightness(1.08)">✓ Added</Hoverable>
                  )}
                </div>
                {!shoeItem && (
                  <div>
                    <div style={css("font-size:11.5px;font-weight:700;color:var(--muted);margin-bottom:6px")}>Choose a size (EU)</div>
                    <div style={css("display:flex;flex-wrap:wrap;gap:6px;align-items:center")}>
                      {SIZES.map((s) => (
                        <div key={s} onClick={() => setShoeSize(s)} style={sx("padding:6px 11px;border-radius:9px;font-size:12.5px;font-weight:700;cursor:pointer;transition:all .14s", shoeSize === s ? { background: "var(--blueBg)", color: "var(--blueInk)", border: "1px solid var(--blueInk)" } : { background: "var(--paper)", color: "var(--ink)", border: "1px solid var(--line)" })}>{s}</div>
                      ))}
                      <Hoverable as="button" onClick={addShoe} styles={sx("margin-left:auto;border-radius:20px;padding:8px 16px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit", shoeSize ? { background: "var(--paper)", color: "var(--maroon)", border: "1.5px solid var(--maroon)" } : { background: "var(--putty)", color: "var(--muted)", border: "1px solid var(--line)", cursor: "default" })} hover={shoeSize ? "background:#fbf3f7" : ""}>+ Add</Hoverable>
                    </div>
                  </div>
                )}
              </div>
            );
          }
          const listing = addonToListing(a);
          const added = inCart.has(listing.id);
          return (
            <div key={a.key} style={sx("display:flex;align-items:center;gap:12px;padding:12px;border-radius:14px", added ? { border: "1.5px solid var(--maroon)", background: "#fbf3f7" } : { border: "1px solid var(--line)", background: "var(--paper)" })}>
              <AddonIcon title={a.title} kind={a.kind} size={48} image={a.image} />
              <div style={css("flex:1;min-width:0")}>
                <div style={css("font-size:13.5px;font-weight:700;color:var(--ink)")}>{a.title} <span style={css("color:var(--muted)")}>+{formatPrice(a.priceCents)}</span></div>
                <div style={css("font-size:12px;color:var(--muted);line-height:1.35;margin-top:2px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical")}>{a.blurb}</div>
              </div>
              <Hoverable as="button" onClick={() => (added ? remove(listing.id) : add(listing))}
                styles={sx("flex:0 0 auto;border-radius:20px;padding:8px 15px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit", added ? { background: "var(--maroon)", color: "#fff", border: "1px solid var(--maroon)" } : { background: "var(--paper)", color: "var(--maroon)", border: "1.5px solid var(--maroon)" })}
                hover={added ? "filter:brightness(1.08)" : "background:#fbf3f7"}>
                {added ? "✓ Added" : "+ Add"}
              </Hoverable>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default ProductPage;
