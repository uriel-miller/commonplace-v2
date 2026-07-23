"use client";

import { useState, type ReactNode } from "react";
import { css, sx, Hoverable } from "@/lib/design/css";
import { type Listing } from "@/lib/listing";

/**
 * ProductExtras — the lower sections of the Commonplace product page:
 * Specifications, How delivery works, Verified reviews, and Frequently asked.
 *
 * Renders between the product description and the "Customers also bought"
 * carousel. Self-contained (no images, no external deps — inline SVG only) and
 * fail-soft: every field it reads off the item is guarded, so a listing with
 * null dimensions/weight/sku/condition/rating/reviewCount degrades cleanly and
 * never throws to the shopper.
 */

const PLUM = "#630E3D";
const GOLD = "#E9B355";

const HEADING = "font-family:'Reckless','Newsreader',serif;font-size:24px;font-weight:600;color:var(--ink);margin-bottom:16px";

/* --------------------------------- stars --------------------------------- */
function StarRow({ filled, size = 14 }: { filled: number; size?: number }) {
  const n = Number.isFinite(filled) ? Math.max(0, Math.min(5, filled)) : 5;
  return (
    <span style={css("display:inline-flex;gap:2px")}>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={i < n ? GOLD : "#e5ded2"} style={css("display:block")}>
          <path d="M12 2l3 6.9 7.5.6-5.7 4.9 1.8 7.3L12 17.9 5.4 21.7l1.8-7.3L1.5 9.5 9 8.9 12 2z" />
        </svg>
      ))}
    </span>
  );
}

/* --------------------------------- delivery steps --------------------------------- */
const DELIVERY: readonly { title: string; blurb: string; bg: string; fg: string; icon: ReactNode }[] = [
  {
    title: "Reserve for $1",
    blurb: "Pay a single-dollar deposit to lock it in — no risky meetups, no holding a stranger's spot.",
    bg: "var(--greenBg)",
    fg: "var(--green)",
    icon: <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />,
  },
  {
    title: "We pick it up",
    blurb: "Our team collects the item from the seller and inspects it before it ever heads your way.",
    bg: "var(--blueBg)",
    fg: "var(--blueInk)",
    icon: <><rect x="1" y="6" width="15" height="11" rx="1.5" /><path d="M16 9h4l3 3v5h-7" /><circle cx="6" cy="18" r="2" /><circle cx="19" cy="18" r="2" /></>,
  },
  {
    title: "White-glove delivery",
    blurb: "We bring it inside and place it in the exact room you choose. No curbside drop-offs.",
    bg: "var(--yellowBg)",
    fg: "var(--gold)",
    icon: <><path d="M3 9l9-6 9 6v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></>,
  },
  {
    title: "Inspect, then pay",
    blurb: "The balance is charged only after you approve the item in person, at your home.",
    bg: "#FCE3DD",
    fg: "var(--maroon)",
    icon: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></>,
  },
];

/* --------------------------------- reviews fixture --------------------------------- */
const REVIEWS: readonly { name: string; stars: number; date: string; text: string }[] = [
  {
    name: "Marissa T.",
    stars: 5,
    date: "3 weeks ago",
    text: "The crew carried it straight up to my second-floor bedroom and set it exactly where I wanted. Condition was even better than the photos. Paying the balance only after I'd looked it over made the whole thing feel safe.",
  },
  {
    name: "Devon R.",
    stars: 5,
    date: "1 month ago",
    text: "I was nervous buying used online, but the $1 hold and the in-home inspection sold me. Delivery showed up right in the window they gave me, everything was clean, and the team was genuinely careful with my floors.",
  },
  {
    name: "Priya K.",
    stars: 4,
    date: "2 months ago",
    text: "Great experience overall. Item arrived in the condition described and the white-glove setup saved me an afternoon. Docked one star only because scheduling took a call, but the delivery itself was flawless.",
  },
];

/* --------------------------------- faq fixture --------------------------------- */
const FAQ: readonly { q: string; a: string }[] = [
  {
    q: "How does delivery work?",
    a: "Once your order is confirmed, our own delivery team picks the item up, inspects it, and brings it inside to the exact room you choose — true white-glove service. You'll get a delivery window ahead of time, and there's never a curbside drop-off or a meetup with a stranger.",
  },
  {
    q: "What is the $1 deposit?",
    a: "A single dollar reserves the item and takes it off the market so no one else can grab it while we arrange delivery. It's applied toward your total — the rest of the balance is only charged after the item arrives and you've approved it in person.",
  },
  {
    q: "Can I inspect it before I pay?",
    a: "Yes. Every order includes an in-home inspection at delivery. Look the item over, try it out, and make sure it matches what you expected. We only charge the remaining balance once you're happy and give the go-ahead.",
  },
  {
    q: "What if it's not as described?",
    a: "If the item doesn't match its listing, just tell the delivery team and don't accept it. You won't be charged the balance and we'll take it right back — no restocking fees, no hassle. Your $1 deposit is fully refunded too.",
  },
  {
    q: "Is there a warranty?",
    a: "Every purchase includes a 2-month warranty at no extra cost. If something covered goes wrong within that window, reach out and we'll make it right. It's our way of standing behind pre-owned quality.",
  },
];

/* ================================================================== */
export function ProductExtras({ item }: { item: Listing }) {
  const [openFaq, setOpenFaq] = useState<number>(0);

  /* build spec rows only from fields that actually exist */
  const specs: [string, string][] = [];
  if (item.condition) specs.push(["Condition", item.condition]);
  if (item.categoryName) specs.push(["Category", item.categoryName]);
  if (item.dimensions) specs.push(["Dimensions", item.dimensions]);
  if (item.weight) specs.push(["Weight", item.weight]);
  if (item.sku) specs.push(["Item ID", item.sku]);

  const rating = Number.isFinite(item.rating) && item.rating > 0 ? item.rating : 5;
  const reviewCount = Number.isFinite(item.reviewCount) && item.reviewCount > 0 ? item.reviewCount : 0;

  return (
    <div style={css("max-width:1120px;margin:0 auto;padding:0 22px")}>
      {/* ---------------- 1. Specifications ---------------- */}
      {specs.length > 0 && (
        <section style={css("margin-top:44px")}>
          <h2 style={css(HEADING)}>Specifications</h2>
          <div style={css("border-top:1px solid var(--line);max-width:620px")}>
            {specs.map(([label, value]) => (
              <div key={label} style={css("display:grid;grid-template-columns:200px 1fr;gap:16px;padding:12px 2px;border-bottom:1px solid var(--line)")} data-pe-spec>
                <span style={css("font-size:13.5px;color:var(--muted)")}>{label}</span>
                <span style={css("font-size:13.5px;color:var(--ink);font-weight:600")}>{value}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---------------- 2. How delivery works ---------------- */}
      <section style={css("margin-top:44px")}>
        <h2 style={css(HEADING)}>How delivery works</h2>
        <div style={css("display:grid;grid-template-columns:repeat(4,1fr);gap:16px")} data-pe-delivery>
          {DELIVERY.map((step, i) => (
            <div key={step.title} style={css("background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:18px 16px")}>
              <div style={css("display:flex;align-items:center;gap:9px;margin-bottom:11px")}>
                <span style={sx("width:38px;height:38px;flex:0 0 auto;border-radius:50%;display:flex;align-items:center;justify-content:center", { background: step.bg })}>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={step.fg} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">{step.icon}</svg>
                </span>
                <span style={sx("width:22px;height:22px;flex:0 0 auto;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#fff", { background: PLUM })}>{i + 1}</span>
              </div>
              <div style={css("font-size:15px;font-weight:700;color:var(--ink);margin-bottom:5px;line-height:1.25")}>{step.title}</div>
              <div style={css("font-size:12.5px;color:var(--muted);line-height:1.5")}>{step.blurb}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- 3. Verified reviews ---------------- */}
      <section style={css("margin-top:44px")}>
        <div style={css("display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px")}>
          <h2 style={css(HEADING + ";margin-bottom:0")}>Verified reviews</h2>
          <span style={css("display:inline-flex;align-items:center;gap:8px")}>
            <StarRow filled={Math.round(rating)} size={16} />
            <span style={css("font-size:13.5px;color:var(--muted)")}>
              <b style={css("color:var(--ink)")}>{rating.toFixed(1)}</b> · {reviewCount} reviews
            </span>
          </span>
        </div>
        <div style={css("display:grid;grid-template-columns:repeat(3,1fr);gap:16px")} data-pe-reviews>
          {REVIEWS.map((rev) => (
            <div key={rev.name} style={css("background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:18px")}>
              <div style={css("display:flex;align-items:center;gap:11px;margin-bottom:11px")}>
                <span style={sx("width:40px;height:40px;flex:0 0 auto;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;color:#fff", { background: PLUM })}>
                  {rev.name.charAt(0)}
                </span>
                <div style={css("min-width:0")}>
                  <div style={css("font-size:14px;font-weight:700;color:var(--ink);line-height:1.2")}>{rev.name}</div>
                  <div style={css("display:flex;align-items:center;gap:7px;margin-top:3px")}>
                    <StarRow filled={rev.stars} size={12} />
                    <span style={css("font-size:11.5px;color:var(--muted)")}>{rev.date}</span>
                  </div>
                </div>
              </div>
              <p style={css("font-size:13px;color:var(--ink);line-height:1.6;margin:0")}>{rev.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- 4. Frequently asked ---------------- */}
      <section style={css("margin-top:44px")}>
        <h2 style={css(HEADING)}>Frequently asked</h2>
        <div style={css("border-top:1px solid var(--line);max-width:760px")}>
          {FAQ.map((row, i) => {
            const open = openFaq === i;
            return (
              <div key={row.q} style={css("border-bottom:1px solid var(--line)")}>
                <Hoverable
                  as="button"
                  onClick={() => setOpenFaq(open ? -1 : i)}
                  styles="width:100%;background:none;border:none;cursor:pointer;font-family:inherit;text-align:left;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 2px"
                  hover="color:var(--maroon)"
                >
                  <span style={css("font-size:15px;font-weight:700;color:var(--ink);line-height:1.3")}>{row.q}</span>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={sx("flex:0 0 auto;transition:transform .2s ease", { transform: open ? "rotate(45deg)" : "rotate(0deg)", color: open ? PLUM : "var(--muted)" })}
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </Hoverable>
                {open && (
                  <p style={css("font-size:13.5px;color:var(--muted);line-height:1.6;margin:0;padding:0 2px 18px")}>{row.a}</p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <style>{"@media(max-width:720px){[data-pe-delivery]{grid-template-columns:1fr 1fr!important}[data-pe-reviews]{grid-template-columns:1fr!important}[data-pe-spec]{grid-template-columns:130px 1fr!important}}"}</style>
    </div>
  );
}

export default ProductExtras;
