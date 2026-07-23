"use client";

import { useEffect, useMemo, useState } from "react";
import { css, sx, Hoverable } from "@/lib/design/css";
import { fetchListings } from "@/lib/clientApi";
import { formatPrice, type Listing } from "@/lib/listing";
import { Pin, ChevronLeft } from "@/components/marketplace/icons";
import { useCart } from "@/components/cart/CartProvider";

/* ============================================================================
   ProductPage — a faithful port of the live Commonplace single-product page.
   Reproduces (in order): hero (gallery + buy box), product details, customers
   also bought, how it works, the comparison, by the numbers, verified reviews,
   FAQ, why Commonplace, ask the seller, and the sticky purchase bar.
   ============================================================================ */

export interface ProductPageProps {
  item: Listing;
  onBack: () => void;
  onOpenCategory: (slug: string, name: string) => void;
  onMakeOffer: () => void;
}

/* --------------------------------- inline icons --------------------------------- */
function ArrowLeftGlyph({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}
function ArrowRightGlyph({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
function Heart({ size = 20, filled }: { size?: number; filled: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "var(--maroon)" : "none"} stroke={filled ? "var(--maroon)" : "var(--ink)"} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
    </svg>
  );
}
function CartGlyph({ size = 18, stroke = "currentColor" }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1.4" /><circle cx="18" cy="21" r="1.4" />
      <path d="M1 1h3l2.6 12.4a2 2 0 0 0 2 1.6h8.7a2 2 0 0 0 2-1.6L23 6H6" />
    </svg>
  );
}
function ShieldCheck({ size = 16, stroke = "var(--green)" }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 5 6v5c0 4.4 3 8.4 7 9.6 4-1.2 7-5.2 7-9.6V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
function TruckGlyph({ size = 22, stroke = "var(--blueInk)" }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="6" width="14" height="10" rx="1.5" /><path d="M15 9h4l3 3.5V16h-7z" />
      <circle cx="6" cy="17.5" r="1.8" /><circle cx="18" cy="17.5" r="1.8" />
    </svg>
  );
}
function HouseGlyph({ size = 18, stroke = "currentColor" }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11 12 4l8 7" /><path d="M6 10v9h12v-9" /><path d="M10 19v-5h4v5" />
    </svg>
  );
}
function PersonGlyph({ size = 18, stroke = "currentColor" }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}
function Stars({ count = 5, size = 13 }: { count?: number; size?: number }) {
  return (
    <span style={css("display:inline-flex;gap:1px;color:var(--gold)")} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="m12 2 3 6.3 6.9.9-5 4.8 1.2 6.9L12 17.8 5.9 20.9 7.1 14l-5-4.8 6.9-.9L12 2Z" />
        </svg>
      ))}
    </span>
  );
}
function PlayGlyph({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#fff">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

/* --------------------------------- static content --------------------------------- */
const HOW_STEPS: readonly [string, string, string, string][] = [
  ["1", "Buy with $1", "Reserve any item with a dollar. You'll only be charged the full amount at delivery.", "var(--maroon)"],
  ["2", "We bring it inside", "Delivery and set up in the room of your choice. No schlepping, no phoning a friend for a favor.", "var(--gold)"],
  ["3", "Inspect, then pay", "Test it out. Sit on it. Open every drawer. Charge the rest only after you say yes.", "var(--blueInk)"],
  ["4", "Peace of mind, covered", "Dedicated human support on every order. Twelve-month warranty available.", "var(--purple)"],
];

const COMPARE_COLS = ["Commonplace", "Retail", "Facebook Marketplace", "OfferUp"] as const;
const COMPARE_ROWS: readonly [string, readonly [boolean, boolean, boolean, boolean], string][] = [
  ["Below-retail price", [true, false, true, true], "Great prices without the flaky negotiation."],
  ["Delivery included", [true, false, false, false], "White-glove, right to the room you choose."],
  ["Installation & setup", [true, false, false, false], "We place it and set it up for you."],
  ["Verified condition", [true, true, false, false], "Inspected at pickup, confirmed before delivery."],
  ["Test & pay at delivery", [true, false, false, false], "You only pay the balance once you say yes."],
  ["Secure checkout", [true, true, false, false], "No cash meetups, no sketchy transfers."],
  ["Real human support", [true, true, false, false], "A person on every order, start to finish."],
];

const NUMBERS: readonly { stat: string; label: string; hl?: boolean }[] = [
  { stat: "3,500+", label: "drivers across the country" },
  { stat: "11,600+", label: "sellers on Commonplace" },
  { stat: "Up to 80%", label: "off retail, every listing", hl: true },
  { stat: "12 mo.", label: "warranty available" },
];

const GOOGLE_REVIEWS: readonly { name: string; loc: string; initial: string; avBg: string; text: string }[] = [
  { name: "Danielle R.", loc: "Montclair, NJ", initial: "D", avBg: "var(--maroon)", text: "The $1 thing sounded too good to be true, but the driver set up our fridge, we tested it, then paid. Genuinely the easiest big purchase we've made." },
  { name: "Marcus T.", loc: "Brooklyn, NY", initial: "M", avBg: "var(--blueInk)", text: "Bought a recumbent bike for half of retail. Delivered inside, no meet-ups, no scammy DMs. Support answered every question within minutes." },
  { name: "Priya S.", loc: "Austin, TX", initial: "P", avBg: "var(--green)", text: "\"Like new\" was actually like new. They'd already inspected it, so there were no surprises when it arrived. Would absolutely buy again." },
  { name: "Owen K.", loc: "Chicago, IL", initial: "O", avBg: "var(--gold)", text: "Made an offer below asking, seller countered, we met in the middle — all through Commonplace. Never had to haggle in a parking lot. Ten out of ten." },
];

const FAQS: readonly [string, string][] = [
  ["How does the $1 deposit work?", "You pay just $1 today to reserve the item. We bring it to your door, you inspect it in person, and only then is the rest of the balance charged. If anything is off, you walk away — your dollar is refunded."],
  ["What if I don't like it once it's here?", "You inspect before you pay the balance. If it's not right, you simply don't take it and you're not charged. No restocking fees, no awkward returns."],
  ["Is \"Like new\" really like new?", "Every listing is verified and inspected at pickup by a Commonplace team member. The condition you see is confirmed before the item is ever delivered to you."],
  ["How does delivery actually work?", "A Commonplace driver picks up the item, transports it, and sets it up in the room of your choice — full white-glove service. No borrowing a truck, no phoning a friend for a favor."],
  ["Can I make an offer below the listed price?", "Yes. Use the \"Make an offer\" link on any listing to send the seller your price. They have 24 hours to accept, decline, or counter — and everything is handled through Commonplace, so you never message the seller directly."],
];

const WHY_TILES: readonly { tone: string; toneBg: string; title: string; desc: string }[] = [
  { tone: "var(--maroon)", toneBg: "var(--tint)", title: "Why Commonplace", desc: "Nethaniel from Commonplace explains our process and why buying used finally feels safe." },
  { tone: "var(--blue)", toneBg: "var(--blueBg)", title: "How Delivery Works", desc: "Naomi from Commonplace walks you through our white-glove delivery process, step by step." },
  { tone: "var(--gold)", toneBg: "var(--yellowBg)", title: "How Offers Work", desc: "Make an offer, get a counter, and settle on a fair price — all without a single awkward meet-up." },
  { tone: "var(--red)", toneBg: "#F3E0DA", title: "How Pickup Works", desc: "See how we inspect and verify every item at pickup so the condition is exactly what you expect." },
];

const SECTION_INTRO = "font-size:14px;color:var(--muted);line-height:1.55;margin-top:6px;max-width:560px";
const EYEBROW = "font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--maroon);font-weight:800";
const SECTION_TITLE = "font-family:'Newsreader',serif;font-size:30px;font-weight:500;letter-spacing:-.4px;line-height:1.12;margin-top:4px";
const SECTION_WRAP = "margin-top:38px;border-top:1px solid var(--line);padding-top:26px";

/* --------------------------------- payment pills --------------------------------- */
const PAY_PILLS: readonly { label: React.ReactNode; bg: string; fg: string; extra?: string }[] = [
  { label: "MC", bg: "#fff", fg: "#EB5B25" },
  { label: "VISA", bg: "#1A1F71", fg: "#fff", extra: "font-style:italic;letter-spacing:.5px" },
  { label: "DISC●VER", bg: "#fff", fg: "#231A1D" },
  { label: "AMEX", bg: "#2E77BC", fg: "#fff" },
  { label: "PayPal", bg: "#fff", fg: "#003087", extra: "font-style:italic" },
  { label: " Pay", bg: "#000", fg: "#fff" },
  { label: "venmo", bg: "#fff", fg: "#008CFF", extra: "font-style:italic" },
  { label: "Klarna.", bg: "#FFB3C7", fg: "#0B051D" },
];

function PaymentPills() {
  return (
    <ul aria-label="Accepted payment methods" style={css("list-style:none;display:flex;flex-wrap:wrap;gap:6px;margin-top:13px;padding:0")}>
      {PAY_PILLS.map((p, i) => (
        <li key={i} style={sx("min-width:38px;height:24px;padding:0 8px;border:1px solid var(--line);border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;line-height:1", { background: p.bg, color: p.fg }, p.extra ?? "")}>
          {p.label}
        </li>
      ))}
    </ul>
  );
}

/* --------------------------------- related card --------------------------------- */
function RelatedCard({ it, onOpen }: { it: Listing; onOpen: () => void }) {
  const img = it.images[0];
  return (
    <Hoverable
      onClick={onOpen}
      styles="display:flex;flex-direction:column;background:var(--paper);border:1px solid var(--line);border-radius:12px;overflow:hidden;cursor:pointer;text-decoration:none;color:inherit;transition:box-shadow .2s ease,border-color .2s ease;box-shadow:0 3px 10px rgba(60,10,35,.05)"
      hover="box-shadow:0 16px 34px rgba(60,10,35,.2);border-color:#d9b7c2"
    >
      <span style={css("position:relative;display:block;aspect-ratio:1;overflow:hidden;background:repeating-linear-gradient(135deg,#EDE4D6 0 14px,#E5DACA 14px 28px)")}>
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={it.title} loading="lazy" style={css("position:absolute;inset:0;width:100%;height:100%;object-fit:cover")} />
        ) : (
          <span style={css("position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:.12em;color:#9a8c78;text-transform:uppercase;text-align:center;padding:10px")}>{it.categoryName}</span>
        )}
      </span>
      <span style={css("display:block;padding:10px 11px 12px")}>
        <span style={css("display:block;font-family:'Newsreader',serif;font-size:13px;font-weight:500;line-height:1.28;height:33px;overflow:hidden;text-wrap:pretty")}>{it.title}</span>
        <span style={css("display:flex;align-items:baseline;gap:7px;margin-top:6px")}>
          <span style={css("font-size:15px;font-weight:800;letter-spacing:-.3px")}>{formatPrice(it.priceCents)}</span>
          {it.retailCents ? <span style={css("font-size:11px;color:var(--muted);text-decoration:line-through")}>{formatPrice(it.retailCents)}</span> : null}
        </span>
      </span>
    </Hoverable>
  );
}

/* ============================================================================
   ProductPage
   ============================================================================ */
export function ProductPage({ item, onBack, onOpenCategory, onMakeOffer }: ProductPageProps) {
  const [active, setActive] = useState(0);
  const [saved, setSaved] = useState(false);
  const [related, setRelated] = useState<Listing[] | null>(null);
  const [openFaqs, setOpenFaqs] = useState<Set<number>>(() => new Set([0]));
  const [question, setQuestion] = useState("");
  const [sent, setSent] = useState(false);
  const { add, has } = useCart();
  const inCart = has(item.id);

  const images = item.images.length > 0 ? item.images : [];
  const hasImages = images.length > 0;

  useEffect(() => {
    let alive = true;
    setActive(0);
    setRelated(null);
    fetchListings({ category: item.categorySlug, perPage: 5, orderby: "recommended" }).then((d) => {
      if (alive) setRelated(d.items.filter((x) => x.id !== item.id).slice(0, 4));
    });
    return () => {
      alive = false;
    };
  }, [item.id, item.categorySlug]);

  const city = useMemo(() => (item.location ? item.location.split(",")[0].trim() : "your area"), [item.location]);
  const rating = item.rating > 0 ? item.rating.toFixed(1) : "5.0";
  const savingsPct = item.savingsPct ?? (item.retailCents ? Math.round((1 - item.priceCents / item.retailCents) * 100) : null);
  const saveDollars = item.retailCents ? Math.round((item.retailCents - item.priceCents) / 100) : 0;
  const floorSavings = Math.max(50, Math.round((item.priceCents / 100) * 0.15));

  const heroImg = hasImages ? images[Math.min(active, images.length - 1)] : null;
  const go = (dir: number) => {
    if (!hasImages) return;
    setActive((a) => (a + dir + images.length) % images.length);
  };
  const toggleFaq = (i: number) =>
    setOpenFaqs((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <div style={css("max-width:1080px;margin:0 auto;padding-bottom:96px")}>
      {/* Breadcrumb */}
      <div style={css("display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:16px")}>
        <a onClick={onBack} style={css("color:var(--blueInk);font-weight:600;cursor:pointer;display:flex;align-items:center;gap:4px")}>
          <ChevronLeft stroke="currentColor" />Browse
        </a>
        <span style={css("color:var(--muted)")}>/</span>
        <a onClick={() => onOpenCategory(item.categorySlug, item.categoryName)} style={css("color:var(--blueInk);font-weight:600;cursor:pointer")}>{item.categoryName}</a>
        <span style={css("color:var(--muted)")}>/</span>
        <span style={css("color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:360px")}>{item.title}</span>
      </div>

      {/* ============================== HERO ============================== */}
      <div style={css("display:grid;grid-template-columns:1.15fr 1fr;gap:30px;align-items:start")}>
        {/* -------- Gallery -------- */}
        <section aria-label="Product images">
          <div style={css("position:relative;aspect-ratio:1;border-radius:16px;overflow:hidden;border:1px solid var(--line);background:repeating-linear-gradient(135deg,#EDE4D6 0 18px,#E5DACA 18px 36px);display:flex;align-items:center;justify-content:center")}>
            {heroImg ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={heroImg} alt={item.title} style={css("position:absolute;inset:0;width:100%;height:100%;object-fit:cover")} />
            ) : (
              <span style={css("font-family:ui-monospace,monospace;font-size:13px;letter-spacing:.14em;color:#9a8c78;text-transform:uppercase")}>{item.categoryName}</span>
            )}

            {/* AI Enhanced badge — only on the first / enhanced image */}
            {active === 0 && hasImages && (
              <span style={css("position:absolute;top:12px;left:12px;background:rgba(35,26,29,.82);color:#fff;padding:5px 10px;border-radius:20px;font-size:11px;font-weight:700;display:flex;align-items:center;gap:5px;backdrop-filter:blur(2px)")}>
                <span aria-hidden>&#10024;</span>AI Enhanced
              </span>
            )}

            {/* Save badge */}
            {savingsPct ? (
              <span style={css("position:absolute;bottom:12px;left:12px;background:var(--green);color:#fff;padding:5px 12px;border-radius:20px;font-size:12px;font-weight:800;box-shadow:0 2px 8px rgba(0,0,0,.14)")}>Save {savingsPct}%</span>
            ) : null}

            {/* Wishlist heart */}
            <Hoverable
              as="button"
              type="button"
              aria-label={saved ? "Saved to wishlist" : "Save to wishlist"}
              aria-pressed={saved}
              onClick={() => setSaved((s) => !s)}
              styles="position:absolute;top:10px;right:10px;width:40px;height:40px;border:none;border-radius:50%;background:rgba(255,255,255,.94);display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.14)"
              hover="filter:brightness(.97)"
            >
              <Heart filled={saved} />
            </Hoverable>

            {/* Prev / next */}
            {images.length > 1 && (
              <>
                <button type="button" aria-label="Previous image" onClick={() => go(-1)} style={css("position:absolute;top:50%;left:12px;transform:translateY(-50%);width:38px;height:38px;border:none;border-radius:50%;background:rgba(255,255,255,.92);display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.16)")}>
                  <ArrowLeftGlyph />
                </button>
                <button type="button" aria-label="Next image" onClick={() => go(1)} style={css("position:absolute;top:50%;right:12px;transform:translateY(-50%);width:38px;height:38px;border:none;border-radius:50%;background:rgba(255,255,255,.92);display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.16)")}>
                  <ArrowRightGlyph />
                </button>
              </>
            )}
          </div>

          {/* Thumbnails */}
          {images.length > 1 && (
            <div style={css("display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-top:9px")}>
              {images.slice(0, 6).map((src, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`View image ${i + 1}`}
                  onClick={() => setActive(i)}
                  style={sx("padding:0;aspect-ratio:1;border-radius:9px;overflow:hidden;cursor:pointer;background:var(--putty)", { border: i === active ? "2px solid var(--maroon)" : "1px solid var(--line)" })}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" loading="lazy" style={css("width:100%;height:100%;object-fit:cover;display:block")} />
                </button>
              ))}
            </div>
          )}
        </section>

        {/* -------- Buy box -------- */}
        <aside aria-label="Purchase options">
          {/* meta row */}
          <div style={css("display:flex;align-items:center;justify-content:space-between;gap:12px")}>
            <div style={css("display:flex;align-items:center;gap:5px;font-size:13px;color:var(--muted)")}>
              <Pin size={14} stroke="var(--maroon)" />{item.location ?? "Nationwide delivery"}
            </div>
            <a href="#reviews" style={css("display:flex;align-items:center;gap:5px;font-size:13px;font-weight:700;color:var(--muted);text-decoration:none")}>
              <Stars size={13} /><span style={css("color:var(--ink)")}>{rating}</span>
            </a>
          </div>

          {/* title */}
          <h1 style={css("font-family:'Newsreader',serif;font-size:27px;font-weight:500;line-height:1.14;letter-spacing:-.4px;margin-top:8px")}>{item.title}</h1>

          {/* price */}
          <div style={css("margin-top:14px")}>
            <div style={css("display:flex;align-items:baseline;gap:11px;flex-wrap:wrap")}>
              <span style={css("font-size:32px;font-weight:800;letter-spacing:-.6px")}>{formatPrice(item.priceCents)}</span>
              {item.retailCents ? <span style={css("font-size:16px;color:var(--muted);text-decoration:line-through")}>Retail {formatPrice(item.retailCents)}</span> : null}
            </div>
            {saveDollars > 0 && (
              <p style={css("font-size:13.5px;margin-top:5px;line-height:1.4")}>
                <strong style={css("color:var(--green)")}>You save ${saveDollars.toLocaleString()}</strong>
                <span aria-hidden style={css("color:var(--muted);margin:0 7px")}>&middot;</span>
                <span style={css("color:var(--muted)")}>Up to 80% off across Commonplace</span>
              </p>
            )}
          </div>

          {/* floor-price teaser */}
          <div style={css("display:flex;align-items:flex-start;gap:10px;margin-top:13px;background:var(--greenBg);border:1px solid #c9e4d4;border-radius:12px;padding:11px 13px")}>
            <span style={css("width:9px;height:9px;flex:0 0 auto;margin-top:5px;border-radius:50%;background:var(--green);box-shadow:0 0 0 4px rgba(59,122,87,.18)")} />
            <div style={css("font-size:13px;line-height:1.45")}>
              <span style={css("display:block")}><strong>Up to ${floorSavings.toLocaleString()} more off</strong> waiting in cart</span>
              <span style={css("display:block;color:var(--green);font-weight:600;margin-top:1px")}>Add to cart to unlock your private offer</span>
            </div>
          </div>

          {/* pay pill */}
          <div style={css("display:flex;align-items:center;gap:9px;margin-top:16px;font-size:13px;color:var(--muted)")}>
            <span style={css("background:var(--maroon);color:#fff;border-radius:20px;padding:5px 13px;font-size:12px;font-weight:800;white-space:nowrap")}>Pay $1 upfront</span>
            <span>rest on delivery.</span>
          </div>

          {/* add to cart */}
          <form
            className="cart"
            onSubmit={(e) => { e.preventDefault(); add(item); }}
            style={css("margin:0")}
          >
            <button type="submit" style={css("width:100%;margin-top:12px;background:var(--maroon);color:#fff;border:none;border-radius:12px;padding:15px;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:9px")}>
              <CartGlyph />{inCart ? "Added to cart ✓" : "Add to cart"}
            </button>
          </form>

          {/* inspection note + make offer */}
          <div style={css("display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:12px")}>
            <p style={css("display:flex;align-items:center;gap:7px;font-size:12.5px;color:var(--muted)")}>
              <ShieldCheck /><strong style={css("color:var(--ink)")}>In-home inspection at delivery.</strong>
            </p>
            <a onClick={onMakeOffer} style={css("font-size:13px;font-weight:800;color:var(--maroon);cursor:pointer;text-decoration:underline;text-underline-offset:2px")}>Make an offer</a>
          </div>

          {/* payments */}
          <PaymentPills />

          {/* delivery ETA */}
          <div style={css("display:flex;align-items:center;gap:11px;margin-top:16px;background:var(--blueBg);border:1px solid #cfe0f2;border-radius:12px;padding:12px 14px")}>
            <span style={css("flex:0 0 auto")}><TruckGlyph /></span>
            <div style={css("flex:1;min-width:0;font-size:13px;line-height:1.35")}>
              <span style={css("display:block;color:var(--muted)")}>Order by <strong style={css("color:var(--ink)")}>today,</strong></span>
              <strong style={css("color:var(--blueInk)")}>Receive by Monday.</strong>
            </div>
            <a onClick={(e) => e.preventDefault()} href="#" style={css("font-size:12.5px;font-weight:700;color:var(--blueInk);cursor:pointer;white-space:nowrap")}>Edit zip</a>
          </div>

          {/* pickup note */}
          <p style={css("display:flex;align-items:center;gap:7px;margin-top:11px;font-size:12.5px;color:var(--muted)")}>
            <Pin size={15} stroke="var(--maroon)" />
            <span>Pickup in <strong style={css("color:var(--ink)")}>{city}</strong>. Delivery available nationwide.</span>
          </p>

          {/* trust tiles */}
          <ul style={css("list-style:none;display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px;padding:0")}>
            {([
              [<TruckGlyph key="t" size={18} stroke="var(--blueInk)" />, "FREE delivery & install", "var(--blueBg)", "var(--blueInk)"],
              [<HouseGlyph key="h" size={18} stroke="var(--maroon)" />, "Inspect upon delivery", "var(--tint)", "var(--maroon)"],
              [<ShieldCheck key="s" size={18} stroke="var(--gold)" />, "2 month warranty included", "var(--yellowBg)", "var(--gold)"],
              [<PersonGlyph key="p" size={18} stroke="var(--purple)" />, "Verified sellers", "#efe7f3", "var(--purple)"],
            ] as const).map(([ico, label, bg, fg], i) => (
              <li key={i} style={sx("display:flex;align-items:center;gap:8px;border-radius:12px;padding:10px 11px;font-size:12px;font-weight:700", { background: bg, color: fg })}>
                <span style={css("flex:0 0 auto;display:flex")}>{ico}</span>{label}
              </li>
            ))}
          </ul>
        </aside>
      </div>

      {/* ============================== PRODUCT DETAILS ============================== */}
      <section id="cp-details" style={css(SECTION_WRAP)}>
        <span style={css(EYEBROW)}>Product details</span>
        <div style={css("display:grid;grid-template-columns:1.4fr 1fr;gap:34px;align-items:start;margin-top:14px")}>
          <div style={css("display:flex;flex-direction:column;gap:11px;font-size:14px;line-height:1.6;color:#3a3033")}>
            {item.description.length > 0 ? item.description.map((p, i) => <p key={i}>{p}</p>) : <p style={css("color:var(--muted)")}>No description provided for this listing.</p>}
          </div>
          <dl style={css("border:1px solid var(--line);border-radius:12px;overflow:hidden;margin:0")}>
            {([
              ["SKU", item.sku || "—"],
              ["Condition", item.condition ?? "—"],
              ["Listing ID", `CP-${item.id}`],
              ...(item.dimensions ? [["Dimensions", item.dimensions] as [string, string]] : []),
              ...(item.weight ? [["Weight", item.weight] as [string, string]] : []),
            ] as [string, string][]).map(([k, v], i) => (
              <div key={k} style={sx("display:flex;justify-content:space-between;gap:12px;padding:12px 14px;font-size:13px", i > 0 ? "border-top:1px solid var(--line)" : "")}>
                <dt style={css("color:var(--muted)")}>{k}</dt>
                <dd style={css("margin:0;font-weight:600;text-align:right")}>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ============================== CUSTOMERS ALSO BOUGHT ============================== */}
      <section style={css(SECTION_WRAP)}>
        <h2 style={css("font-family:'Newsreader',serif;font-size:26px;font-weight:500;letter-spacing:-.3px;margin-bottom:16px")}>Customers also bought</h2>
        {related === null ? (
          <div style={css("display:grid;grid-template-columns:repeat(4,1fr);gap:12px")}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={css("border:1px solid var(--line);border-radius:12px;overflow:hidden")}>
                <div style={css("aspect-ratio:1;background:repeating-linear-gradient(135deg,#EDE4D6 0 14px,#E5DACA 14px 28px);opacity:.5")} />
                <div style={css("padding:11px")}>
                  <div style={css("height:11px;border-radius:5px;background:var(--putty);margin-bottom:7px")} />
                  <div style={css("height:13px;width:45%;border-radius:5px;background:var(--line)")} />
                </div>
              </div>
            ))}
          </div>
        ) : related.length > 0 ? (
          <div style={css("display:grid;grid-template-columns:repeat(4,1fr);gap:12px")}>
            {related.map((r) => (
              <RelatedCard key={r.id} it={r} onOpen={() => onOpenCategory(r.categorySlug, r.categoryName)} />
            ))}
          </div>
        ) : (
          <p style={css("color:var(--muted);font-size:14px")}>More from {item.categoryName} is on the way — check back soon.</p>
        )}
      </section>

      {/* ============================== HOW IT WORKS ============================== */}
      <section style={css(SECTION_WRAP)}>
        <span style={css(EYEBROW)}>How it works</span>
        <h2 style={css(SECTION_TITLE)}>Buying used, finally done right.</h2>
        <p style={css(SECTION_INTRO)}>No flaky meet-ups, no &ldquo;as-is&rdquo; surprises. Four steps, and a real human at every one.</p>
        <ol style={css("list-style:none;display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:20px;padding:0")}>
          {HOW_STEPS.map(([n, t, d, c]) => (
            <li key={n} style={css("background:var(--tint);border-radius:14px;padding:18px")}>
              <span style={sx("width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:13px", { background: c })}>{n}</span>
              <h3 style={css("font-family:'Newsreader',serif;font-size:17px;font-weight:600;margin-top:12px")}>{t}</h3>
              <p style={css("font-size:12.5px;color:var(--muted);line-height:1.5;margin-top:5px")}>{d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ============================== THE COMPARISON ============================== */}
      <section style={css(SECTION_WRAP)}>
        <span style={css(EYEBROW)}>The comparison</span>
        <h2 style={css(SECTION_TITLE)}>How Commonplace Compares</h2>
        <div style={css("overflow-x:auto;margin-top:20px;border:1px solid var(--line);border-radius:14px")}>
          <table style={css("width:100%;min-width:640px;border-collapse:collapse;font-size:13px")}>
            <thead>
              <tr>
                <th style={css("text-align:left;padding:14px 16px;background:var(--paper)")} />
                {COMPARE_COLS.map((c, i) => (
                  <th key={c} style={sx("padding:14px 12px;font-size:13px;font-weight:800;border-left:1px solid var(--line)", i === 0 ? { background: "var(--tint)", color: "var(--maroon)" } : { background: "var(--paper)", color: "var(--muted)" })}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map(([label, cells, sub], ri) => (
                <tr key={label} style={css("border-top:1px solid var(--line)")}>
                  <td style={css("padding:13px 16px;background:var(--paper)")}>
                    <div style={css("font-weight:700")}>{label}</div>
                    <div style={css("font-size:11.5px;color:var(--muted);line-height:1.4;margin-top:2px;max-width:230px")}>{sub}</div>
                  </td>
                  {cells.map((on, ci) => (
                    <td key={ci} style={sx("padding:13px 12px;text-align:center;border-left:1px solid var(--line)", ci === 0 ? "background:var(--tint)" : (ri % 2 ? "background:var(--paper)" : "background:#fffdf9"))}>
                      {on ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={ci === 0 ? "var(--maroon)" : "var(--green)"} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" style={css("display:inline-block;vertical-align:middle")}><path d="M20 6 9 17l-5-5" /></svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c9bcae" strokeWidth={2.4} strokeLinecap="round" style={css("display:inline-block;vertical-align:middle")}><path d="M6 6l12 12M18 6 6 18" /></svg>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ============================== BY THE NUMBERS ============================== */}
      <section style={css(SECTION_WRAP)}>
        <div style={css("display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap")}>
          <div>
            <span style={css(EYEBROW)}>By the numbers</span>
            <h2 style={css("font-family:'Newsreader',serif;font-size:34px;font-weight:500;letter-spacing:-.5px;margin-top:4px")}>Commonplace</h2>
          </div>
          {/* decorative art */}
          <svg width="200" height="80" viewBox="0 0 200 80" fill="none" aria-hidden style={css("opacity:.9;max-width:100%")}>
            <rect x="6" y="46" width="26" height="28" rx="3" fill="var(--tint)" />
            <rect x="42" y="30" width="26" height="44" rx="3" fill="var(--blueBg)" />
            <rect x="78" y="16" width="26" height="58" rx="3" fill="var(--yellowBg)" />
            <rect x="114" y="34" width="26" height="40" rx="3" fill="var(--greenBg)" />
            <rect x="150" y="22" width="26" height="52" rx="3" fill="var(--tint)" />
            <path d="M8 42 52 26 88 12 128 30 172 18" stroke="var(--maroon)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <ul style={css("list-style:none;display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:20px;padding:0")}>
          {NUMBERS.map((n) => (
            <li key={n.label} style={sx("border-radius:14px;padding:18px;border:1px solid var(--line)", n.hl ? { background: "var(--maroon)", borderColor: "var(--maroon)" } : { background: "var(--paper)" })}>
              <strong style={sx("display:block;font-family:'Newsreader',serif;font-size:30px;font-weight:600;letter-spacing:-.5px", n.hl ? { color: "#fff" } : { color: "var(--ink)" })}>{n.stat}</strong>
              <span style={sx("display:block;font-size:12.5px;line-height:1.4;margin-top:4px", n.hl ? { color: "rgba(255,255,255,.85)" } : { color: "var(--muted)" })}>{n.label}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ============================== VERIFIED REVIEWS ============================== */}
      <section id="reviews" style={css(SECTION_WRAP)}>
        <span style={css(EYEBROW)}>Verified buyers</span>
        <h2 style={css(SECTION_TITLE)}>What buyers say about Commonplace.</h2>
        <p style={css(SECTION_INTRO)}>Reviews from real customers, powered by Google.</p>
        <div style={css("display:flex;gap:14px;overflow-x:auto;margin-top:20px;padding:4px 2px 10px;scroll-snap-type:x mandatory")}>
          {GOOGLE_REVIEWS.map((r) => (
            <div key={r.name} style={css("flex:0 0 300px;max-width:300px;scroll-snap-align:start;background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:16px;box-shadow:0 3px 10px rgba(60,10,35,.05)")}>
              <div style={css("display:flex;align-items:center;gap:10px")}>
                <span style={sx("width:38px;height:38px;flex:0 0 auto;border-radius:50%;color:#fff;font-weight:700;font-size:15px;display:flex;align-items:center;justify-content:center", { background: r.avBg })}>{r.initial}</span>
                <div style={css("min-width:0;flex:1")}>
                  <div style={css("font-size:13.5px;font-weight:700;line-height:1.2")}>{r.name}</div>
                  <div style={css("font-size:11.5px;color:var(--muted)")}>{r.loc}</div>
                </div>
                {/* Google glyph */}
                <span style={css("width:22px;height:22px;flex:0 0 auto;border-radius:50%;background:#fff;border:1px solid var(--line);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;color:#4285F4")}>G</span>
              </div>
              <div style={css("margin-top:9px")}><Stars size={14} /></div>
              <p style={css("font-size:13px;color:#3a3033;line-height:1.55;margin-top:8px")}>{r.text}</p>
            </div>
          ))}
        </div>
        <div style={css("display:flex;align-items:center;gap:6px;margin-top:6px;font-size:12px;color:var(--muted)")}>
          <span style={css("font-weight:800;color:#4285F4")}>G</span> powered by Google
        </div>
      </section>

      {/* ============================== FAQ ============================== */}
      <section style={sx(SECTION_WRAP, "max-width:840px")}>
        <span style={css(EYEBROW)}>FAQ</span>
        <h2 style={css(SECTION_TITLE)}>Questions, answered.</h2>
        <ul style={css("list-style:none;margin-top:14px;padding:0")}>
          {FAQS.map(([q, a], i) => {
            const open = openFaqs.has(i);
            return (
              <li key={i} style={css("border-top:1px solid var(--line)")}>
                <button type="button" onClick={() => toggleFaq(i)} aria-expanded={open} style={css("width:100%;background:none;border:none;font-family:inherit;text-align:left;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 0;cursor:pointer;color:var(--ink)")}>
                  <span style={css("flex:1;font-size:15px;font-weight:700")}>{q}</span>
                  <span style={sx("width:26px;height:26px;flex:0 0 auto;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;line-height:1", open ? { background: "var(--maroon)", color: "#fff" } : { background: "var(--putty)", color: "var(--ink)" })}>{open ? "–" : "+"}</span>
                </button>
                {open && <p style={css("font-size:14px;color:var(--muted);line-height:1.6;padding:0 0 16px")}>{a}</p>}
              </li>
            );
          })}
        </ul>
      </section>

      {/* ============================== WHY COMMONPLACE ============================== */}
      <section style={css(SECTION_WRAP)}>
        <h2 style={css("font-family:'Newsreader',serif;font-size:30px;font-weight:500;letter-spacing:-.4px")}>Why Commonplace?</h2>
        <div style={css("display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:18px")}>
          {WHY_TILES.map((t) => (
            <Hoverable
              key={t.title}
              as="button"
              type="button"
              styles="text-align:left;padding:0;border:1px solid var(--line);border-radius:14px;overflow:hidden;background:var(--paper);cursor:pointer;font-family:inherit;color:inherit;transition:box-shadow .18s ease"
              hover="box-shadow:0 14px 30px rgba(60,10,35,.16)"
            >
              <span style={sx("position:relative;display:flex;align-items:center;justify-content:center;aspect-ratio:16/10", { background: t.toneBg })}>
                <span style={sx("width:46px;height:46px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,.16)", { background: t.tone })}>
                  <PlayGlyph />
                </span>
              </span>
              <span style={css("display:block;padding:12px 13px 14px")}>
                <span style={css("display:block;font-family:'Newsreader',serif;font-size:16px;font-weight:600")}>{t.title}</span>
                <span style={css("display:block;font-size:12px;color:var(--muted);line-height:1.45;margin-top:4px")}>{t.desc}</span>
              </span>
            </Hoverable>
          ))}
        </div>
      </section>

      {/* ============================== ASK THE SELLER ============================== */}
      <section style={sx(SECTION_WRAP, "max-width:840px")}>
        <h2 style={css("font-family:'Newsreader',serif;font-size:26px;font-weight:500;letter-spacing:-.3px")}>Ask the Seller</h2>
        <p style={css("color:var(--muted);font-size:13.5px;margin:4px 0 14px")}>Routed and answered through Commonplace — buyers and sellers never message each other directly.</p>
        <div style={css("border:1px solid var(--line);border-radius:14px;padding:16px;background:var(--paper)")}>
          <textarea
            value={question}
            onChange={(e) => { setQuestion(e.target.value); setSent(false); }}
            rows={3}
            placeholder="Ask about condition, accessories, dimensions…"
            style={css("width:100%;border:1px solid var(--line);border-radius:10px;padding:11px 12px;font-size:14px;font-family:inherit;color:var(--ink);outline:none;resize:vertical;line-height:1.45;background:var(--cream)")}
          />
          <div style={css("display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:10px")}>
            <span style={css("font-size:12px;color:var(--green);font-weight:600")}>{sent ? "Sent — Commonplace will relay the reply to you." : " "}</span>
            <button
              type="button"
              disabled={!question.trim()}
              onClick={() => { if (question.trim()) { setSent(true); setQuestion(""); } }}
              style={sx("border:none;border-radius:9px;padding:10px 18px;font-size:13.5px;font-weight:700;font-family:inherit;cursor:pointer;transition:background .15s", question.trim() ? { background: "var(--maroon)", color: "#fff" } : { background: "var(--putty)", color: "var(--muted)", cursor: "not-allowed" })}
            >
              Ask via Commonplace
            </button>
          </div>
        </div>
      </section>

      {/* ============================== STICKY BAR ============================== */}
      <div style={css("position:sticky;bottom:0;left:0;right:0;margin-top:40px;background:var(--paper);border:1px solid var(--line);border-radius:14px;box-shadow:0 -6px 24px rgba(60,10,35,.1);padding:12px 16px;display:flex;align-items:center;gap:14px;z-index:30")}>
        <div style={css("width:44px;height:44px;flex:0 0 auto;border-radius:9px;overflow:hidden;background:repeating-linear-gradient(135deg,#EDE4D6 0 10px,#E5DACA 10px 20px)")}>
          {heroImg && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={heroImg} alt="" style={css("width:100%;height:100%;object-fit:cover")} />
          )}
        </div>
        <div style={css("flex:1;min-width:0")}>
          <div style={css("font-size:13.5px;font-weight:700;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{item.title}</div>
          <div style={css("display:flex;align-items:baseline;gap:8px;margin-top:1px")}>
            <span style={css("font-size:16px;font-weight:800;letter-spacing:-.3px")}>{formatPrice(item.priceCents)}</span>
            <span style={css("font-size:11.5px;color:var(--muted)")}>Pay $1 upfront &middot; rest on delivery</span>
          </div>
        </div>
        <button type="button" onClick={onMakeOffer} style={css("flex:0 0 auto;background:#fff;color:var(--maroon);border:1px solid var(--maroon);border-radius:10px;padding:11px 16px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit")}>Make an offer</button>
        <button type="button" onClick={() => add(item)} style={css("flex:0 0 auto;background:var(--maroon);color:#fff;border:none;border-radius:10px;padding:11px 20px;font-size:13.5px;font-weight:800;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:8px")}>
          <CartGlyph size={16} />{inCart ? "Added ✓" : "Add to cart"}
        </button>
      </div>
    </div>
  );
}
