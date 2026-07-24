"use client";

import { useState } from "react";
import { css, sx, Hoverable } from "@/lib/design/css";
import { type Listing } from "@/lib/listing";

/**
 * ProductExtras — the real lower sections of the live trycommonplace.com
 * product page, in order:
 *   1. How Commonplace Compares (comparison table)
 *   2. By the numbers (stat cards)
 *   3. What buyers say about Commonplace. (testimonials)
 *   4. Questions, answered. (accordion FAQ)
 *   5. Why Commonplace? (video cards)
 *   6. Ask the Seller (question box)
 *
 * Renders between the product description and the "Customers also bought"
 * carousel. Self-contained (no images, no external deps — inline SVG only) and
 * fail-soft: every field it reads off the item is guarded and no interaction
 * can throw to the shopper.
 */

const PLUM = "#630E3D";
const GOLD = "#E9B355";

const EYEBROW = "font-size:11.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:" + PLUM + ";margin-bottom:8px";
const HEADING = "font-family:'Reckless','Newsreader',serif;font-size:24px;font-weight:600;color:var(--ink);margin-bottom:16px";

/* --------------------------------- icons --------------------------------- */
function Check({ gold }: { gold?: boolean }) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={gold ? GOLD : "var(--green)"} strokeWidth={gold ? 2.8 : 2.4} strokeLinecap="round" strokeLinejoin="round" style={css("display:inline-block;vertical-align:middle")}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function Cross() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#c9bcae" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={css("display:inline-block;vertical-align:middle")}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function Star({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={GOLD} style={css("display:block")}>
      <path d="M12 2l3 6.9 7.5.6-5.7 4.9 1.8 7.3L12 17.9 5.4 21.7l1.8-7.3L1.5 9.5 9 8.9 12 2z" />
    </svg>
  );
}

/* --------------------------------- fixtures --------------------------------- */
const COMPARE_COLS = ["Commonplace", "Retail", "Facebook Marketplace", "OfferUp"] as const;

const COMPARE_ROWS: readonly { label: string; cells: [boolean, boolean, boolean, boolean]; sub: string }[] = [
  { label: "Below-retail price", cells: [true, false, true, true], sub: "Great prices without the flaky negotiation." },
  { label: "Delivery included", cells: [true, false, false, false], sub: "White-glove, right to the room you choose." },
  { label: "Installation & setup", cells: [true, false, false, false], sub: "We place it and set it up for you." },
  { label: "Verified condition", cells: [true, true, false, false], sub: "Inspected at pickup, confirmed before delivery." },
  { label: "Test & pay at delivery", cells: [true, false, false, false], sub: "You only pay the balance once you say yes." },
  { label: "Secure checkout", cells: [true, true, false, false], sub: "No cash meetups, no sketchy transfers." },
  { label: "Real human support", cells: [true, true, false, false], sub: "A person on every order, start to finish." },
];

const STATS: readonly [string, string][] = [
  ["12,000+", "items delivered"],
  ["5.0★", "average buyer rating"],
  ["50", "states served"],
  ["$1", "to reserve anything"],
];

const TESTIMONIALS: readonly { name: string; text: string }[] = [
  { name: "Marissa T.", text: "The crew carried it straight up to my second-floor bedroom and set it up exactly where I wanted. Condition was even better than the photos, and paying only after I'd looked it over made the whole thing feel safe." },
  { name: "Devon R.", text: "I was nervous buying used online, but the $1 hold and in-home inspection sold me. Delivery arrived right in the window they gave me, everything was spotless, and the team was so careful with my floors." },
  { name: "Priya K.", text: "The white-glove setup saved me an entire afternoon. It showed up in exactly the condition described, and having a real person to text the whole time made it feel effortless." },
];

const FAQ: readonly { q: string; a: string }[] = [
  { q: "How does the $1 deposit work?", a: "A single dollar reserves the item and takes it off the market so no one else can grab it while we arrange delivery. It's applied toward your total — the rest of the balance is only charged after the item arrives and you've approved it in person." },
  { q: "How does delivery work?", a: "Once your order is confirmed, our own team picks the item up, inspects it, and brings it inside to the exact room you choose — true white-glove service. You'll get a delivery window ahead of time, with no curbside drop-offs and no meetups with strangers." },
  { q: "Can I inspect it before paying?", a: "Yes. Every order includes an in-home inspection at delivery. Look the item over, try it out, and make sure it matches what you expected. We only charge the remaining balance once you're happy and give the go-ahead." },
  { q: "What if it's not as described?", a: "If the item doesn't match its listing, just tell the delivery team and don't accept it. You won't be charged the balance, we'll take it right back with no restocking fees, and your $1 deposit is fully refunded." },
  { q: "Is there a warranty?", a: "Every purchase includes a 2-month warranty at no extra cost. If something covered goes wrong within that window, reach out and we'll make it right — our way of standing behind pre-owned quality." },
];

const VIDEOS: readonly { title: string; id: string }[] = [
  { title: "What is Commonplace", id: "QZAyLOrvRBk" },
  { title: "How Delivery Works", id: "6wDf6DM1Qxs" },
  { title: "How Offers Work", id: "GECSvwp3u10" },
  { title: "How Pickup Works", id: "pL03sBZGS34" },
];

/* ================================================================== */
export function ProductExtras({ item, onPlayVideo }: { item: Listing; onPlayVideo?: (id: string) => void }) {
  const [openFaq, setOpenFaq] = useState<number>(0);
  const [ask, setAsk] = useState("");
  const [asked, setAsked] = useState(false);

  // rating / reviewCount are read fail-soft; not surfaced in these sections but
  // guarded here so any future use degrades cleanly.
  void (Number.isFinite(item?.rating) ? item.rating : 5);
  void (Number.isFinite(item?.reviewCount) ? item.reviewCount : 0);

  function openVideo(id: string) {
    // Prefer the in-page lightbox pop-up; fall back to opening YouTube.
    if (onPlayVideo) { try { onPlayVideo(id); return; } catch { /* fall through */ } }
    try {
      window.open("https://www.youtube.com/watch?v=" + id, "_blank", "noopener");
    } catch {
      /* fail-soft: never throw to the shopper */
    }
  }

  function submitAsk() {
    if (ask.trim().length === 0) return;
    setAsk("");
    setAsked(true);
  }

  return (
    <div style={css("max-width:1120px;margin:0 auto;padding:0 22px")}>
      {/* ---------------- 1. How Commonplace Compares ---------------- */}
      <section style={css("margin-top:48px")}>
        <div style={css(EYEBROW)}>The Comparison</div>
        <h2 style={css(HEADING)}>How Commonplace Compares</h2>
        <div style={css("border:1px solid var(--line);border-radius:14px;overflow:hidden")}>
          <div style={css("overflow-x:auto")}>
            <table style={css("width:100%;min-width:640px;border-collapse:collapse")}>
              <thead>
                <tr>
                  <th style={css("text-align:left;padding:14px 16px;background:var(--paper)")} />
                  {COMPARE_COLS.map((col, ci) => (
                    <th
                      key={col}
                      style={sx(
                        "padding:14px 12px;font-size:13px;text-align:center;line-height:1.25;min-width:110px",
                        ci === 0 ? "font-weight:800;background:var(--tint);color:var(--maroon)" : "font-weight:600;background:var(--paper);color:var(--muted)"
                      )}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row, ri) => (
                  <tr key={row.label} style={css(ri === 0 ? "" : "border-top:1px solid var(--line)")}>
                    <td style={css("padding:14px 16px;vertical-align:top")}>
                      <div style={css("font-size:14px;font-weight:700;color:var(--ink);line-height:1.3")}>{row.label}</div>
                      <div style={css("font-size:12px;color:var(--muted);line-height:1.45;margin-top:3px;max-width:230px")}>{row.sub}</div>
                    </td>
                    {row.cells.map((yes, ci) => (
                      <td
                        key={ci}
                        style={sx("padding:14px 12px;text-align:center;vertical-align:middle", ci === 0 ? { background: "var(--tint)" } : {})}
                      >
                        {yes ? <Check gold={ci === 0} /> : <Cross />}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ---------------- 2. By the numbers ---------------- */}
      <section style={css("margin-top:48px")}>
        <div style={css(EYEBROW)}>By the Numbers</div>
        <h2 style={css(HEADING)}>Commonplace</h2>
        <div style={css("display:grid;grid-template-columns:repeat(4,1fr);gap:16px")} data-pe-stats>
          {STATS.map(([num, label]) => (
            <div key={label} style={css("background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:22px 18px;text-align:center")}>
              <div style={sx("font-family:'Reckless','Newsreader',serif;font-size:34px;font-weight:600;line-height:1.05;letter-spacing:-.5px", { color: PLUM })}>{num}</div>
              <div style={css("font-size:12.5px;color:var(--muted);margin-top:6px;line-height:1.35")}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- 3. What buyers say ---------------- */}
      <section style={css("margin-top:48px")}>
        <h2 style={css(HEADING)}>What buyers say about Commonplace.</h2>
        <div style={css("display:grid;grid-template-columns:repeat(3,1fr);gap:16px")} data-pe-testi>
          {TESTIMONIALS.map((t) => (
            <div key={t.name} style={css("background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:18px;display:flex;flex-direction:column")}>
              <div style={css("display:flex;gap:2px;margin-bottom:11px")}>
                {[0, 1, 2, 3, 4].map((i) => <Star key={i} size={15} />)}
              </div>
              <p style={css("font-size:13px;color:var(--ink);line-height:1.6;margin:0 0 16px;flex:1")}>&ldquo;{t.text}&rdquo;</p>
              <div style={css("display:flex;align-items:center;gap:11px")}>
                <span style={sx("width:38px;height:38px;flex:0 0 auto;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800;color:#fff", { background: PLUM })}>{t.name.charAt(0)}</span>
                <div style={css("min-width:0")}>
                  <div style={css("font-size:13.5px;font-weight:700;color:var(--ink);line-height:1.2")}>{t.name}</div>
                  <div style={css("font-size:11.5px;color:var(--muted);margin-top:2px")}>Verified buyer</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- 4. Questions, answered ---------------- */}
      <section style={css("margin-top:48px")}>
        <h2 style={css(HEADING)}>Questions, answered.</h2>
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
                    style={sx("flex:0 0 auto;transition:transform .2s ease", { transform: open ? "rotate(180deg)" : "rotate(0deg)", color: open ? PLUM : "var(--muted)" })}
                  >
                    <path d="m6 9 6 6 6-6" />
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

      {/* ---------------- 5. Why Commonplace? (videos) ---------------- */}
      <section style={css("margin-top:48px")}>
        <h2 style={css(HEADING)}>Why Commonplace?</h2>
        <div style={css("display:grid;grid-template-columns:repeat(4,1fr);gap:16px")} data-pe-videos>
          {VIDEOS.map((v) => (
            <Hoverable
              key={v.id}
              as="div"
              onClick={() => openVideo(v.id)}
              styles="cursor:pointer"
              hover="transform:translateY(-2px)"
            >
              <div style={sx("width:100%;aspect-ratio:16/10;border-radius:14px;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden", { background: "linear-gradient(150deg,#7A2740,#420926)" })}>
                <span style={css("width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,.16);border:1.5px solid rgba(255,255,255,.5);display:flex;align-items:center;justify-content:center")}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff" style={css("margin-left:3px")}>
                    <path d="M6 4l14 8-14 8z" />
                  </svg>
                </span>
              </div>
              <div style={css("font-size:13.5px;font-weight:700;color:var(--ink);margin-top:10px;line-height:1.3")}>{v.title}</div>
            </Hoverable>
          ))}
        </div>
      </section>

      {/* ---------------- 6. Ask the Seller ---------------- */}
      <section style={css("margin-top:48px")}>
        <h2 style={css(HEADING)}>Ask the Seller</h2>
        <div style={css("background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:20px")}>
          <div style={css("font-size:12.5px;font-weight:700;color:var(--muted);letter-spacing:.02em;margin-bottom:6px")}>0 Questions</div>
          <p style={css("font-size:13.5px;color:var(--ink);line-height:1.55;margin:0 0 14px")}>Be the first to ask a question about this item — our team answers fast.</p>
          <div style={css("display:flex;gap:10px;flex-wrap:wrap")} data-pe-ask>
            <input
              value={ask}
              onChange={(e) => { setAsk(e.target.value); if (asked) setAsked(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") submitAsk(); }}
              placeholder="Ask a question…"
              style={css("flex:1;min-width:220px;border:1px solid var(--line);border-radius:999px;padding:12px 18px;font-size:14px;font-family:inherit;color:var(--ink);background:var(--cream);outline:none")}
            />
            <Hoverable
              as="button"
              onClick={submitAsk}
              styles={`background:${PLUM};color:#fff;border:none;border-radius:999px;padding:12px 26px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;flex:0 0 auto`}
              hover="filter:brightness(1.1)"
            >
              Ask
            </Hoverable>
          </div>
          {asked && (
            <div style={css("font-size:12.5px;color:var(--muted);margin-top:11px")}>Thanks! We&apos;ll get you an answer shortly.</div>
          )}
        </div>
      </section>

      <style>{"@media(max-width:720px){[data-pe-stats]{grid-template-columns:1fr 1fr!important}[data-pe-testi]{grid-template-columns:1fr!important}[data-pe-videos]{grid-template-columns:1fr 1fr!important}}"}</style>
    </div>
  );
}

export default ProductExtras;
