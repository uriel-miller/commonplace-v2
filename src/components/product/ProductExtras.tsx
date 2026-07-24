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
function Check() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" style={css("display:inline-block;vertical-align:middle")}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function Cross() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" style={css("display:inline-block;vertical-align:middle")}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

/** Green dollar-sign glyphs — the live "Total Price" row (fewer = cheaper). */
function Dollars({ n }: { n: number }) {
  return (
    <span style={css("display:inline-flex;align-items:center;gap:1px")}>
      {Array.from({ length: Math.max(1, n) }, (_, i) => (
        <svg key={i} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      ))}
    </span>
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

// Mirrors the live "How Commonplace Compares" table exactly.
//   kind "price" → cells are $-sign counts (fewer = cheaper)
//   kind "text"  → cells are labels; null renders a red ✕
//   kind "check" → cells are booleans (✓ / ✕)
type CompareKind = "price" | "text" | "check";
const COMPARE_ROWS: readonly { label: string; kind: CompareKind; cells: readonly (boolean | number | string | null)[] }[] = [
  { label: "Total Price", kind: "price", cells: [1, 3, 1, 1] },
  { label: "Home Delivery", kind: "text", cells: ["Always", "Sometimes", null, null] },
  { label: "In-home installation", kind: "check", cells: [true, true, false, false] },
  { label: "Verified condition", kind: "check", cells: [true, true, false, false] },
  { label: "Test and pay at delivery", kind: "check", cells: [true, false, false, false] },
  { label: "Secure checkout", kind: "check", cells: [true, true, false, false] },
  { label: "Dedicated human support", kind: "check", cells: [true, false, false, false] },
];

// [number, label, accent] — matches the live "By the Numbers" band exactly.
const STATS: readonly [string, string, string][] = [
  ["3,500+", "drivers across the country", "var(--maroon)"],
  ["11,600+", "sellers on Commonplace", "var(--maroon)"],
  ["Up to 80%", "off retail, every listing", "var(--purple)"],
  ["12 mo.", "warranty available", "var(--blue)"],
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

// Tall gradient story-cards — mirrors the live "Why Commonplace?" section.
const VIDEOS: readonly { title: string; id: string; desc: string; from: string; to: string }[] = [
  { title: "Why Commonplace", id: "QZAyLOrvRBk", desc: "Nethaniel from Commonplace explains our process so you know exactly what to expect, from start to finish.", from: "#7A1F44", to: "#360C1F" },
  { title: "How Delivery Works", id: "6wDf6DM1Qxs", desc: "Naomi from Commonplace walks you through our delivery process, so there are no surprises.", from: "#8FB1DD", to: "#3C5C88" },
  { title: "How Offers Work", id: "GECSvwp3u10", desc: "Ari from Commonplace explains how the “make an offer” feature works, so you can get the best price with confidence.", from: "#D8C24E", to: "#877019" },
  { title: "How Pickup Works", id: "pL03sBZGS34", desc: "Ari from Commonplace shares how pickup works. So, you know exactly what happens from inspection through to payment.", from: "#D2603F", to: "#89291A" },
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
    <div style={css("max-width:1340px;margin:0 auto;padding:0 22px")}>
      {/* ---------------- 1. How Commonplace Compares ---------------- */}
      <section style={css("margin-top:48px")}>
        <div style={css(EYEBROW)}>The Comparison</div>
        <h2 style={css(HEADING)}>How Commonplace Compares</h2>
        <div style={css("border:1px solid var(--line);border-radius:16px;overflow:hidden")}>
          <div style={css("overflow-x:auto")}>
            <table style={css("width:100%;min-width:640px;border-collapse:collapse")}>
              <thead>
                <tr>
                  <th style={css("text-align:left;padding:16px 18px;background:var(--paper);font-size:13px;font-weight:600;color:var(--muted)")}>Services</th>
                  {COMPARE_COLS.map((col, ci) => (
                    <th
                      key={col}
                      style={sx(
                        "padding:16px 12px;font-size:13.5px;text-align:center;line-height:1.25;min-width:120px",
                        ci === 0
                          ? { background: "var(--yellowBg)", color: "var(--maroon)", fontWeight: 800, fontFamily: "'Reckless','Newsreader',serif", fontSize: "17px", borderTopLeftRadius: "10px", borderTopRightRadius: "10px" }
                          : "font-weight:600;background:var(--paper);color:var(--muted)"
                      )}
                    >
                      {ci === 0 ? "commonplace" : col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row, ri) => (
                  <tr key={row.label} style={css(ri === 0 ? "" : "border-top:1px solid var(--line)")}>
                    <td style={css("padding:15px 18px;font-size:14px;font-weight:600;color:var(--ink);line-height:1.3")}>{row.label}</td>
                    {row.cells.map((val, ci) => (
                      <td
                        key={ci}
                        style={sx("padding:15px 12px;text-align:center;vertical-align:middle;font-size:13.5px", ci === 0 ? { background: "var(--yellowBg)" } : {})}
                      >
                        {row.kind === "price"
                          ? <Dollars n={Number(val) || 1} />
                          : row.kind === "text"
                            ? (val == null ? <Cross /> : <span style={sx("font-weight:700", ci === 0 ? { color: "var(--maroon)" } : { color: "var(--ink)" })}>{String(val)}</span>)
                            : (val ? <Check /> : <Cross />)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ---------------- 2. By the numbers (single horizontal band) ---------------- */}
      <section style={css("margin-top:48px")}>
        <div style={css("background:#FBF1EA;border-radius:22px;padding:26px 32px;display:flex;align-items:center;gap:32px;flex-wrap:wrap")}>
          <div style={css("flex:0 0 auto")}>
            <div style={css("font-size:11.5px;font-weight:800;letter-spacing:.13em;text-transform:uppercase;color:var(--maroon);margin-bottom:5px")}>By the Numbers</div>
            <div style={css("font-family:'Reckless','Newsreader',serif;font-size:27px;font-weight:500;color:var(--ink);line-height:1.1")}>Commonplace</div>
          </div>
          <div style={css("flex:1 1 320px;display:grid;grid-template-columns:repeat(4,1fr);gap:22px")} data-pe-stats>
            {STATS.map(([num, label, color]) => (
              <div key={label}>
                <div style={sx("font-size:27px;font-weight:800;line-height:1.05;letter-spacing:-.4px", { color })}>{num}</div>
                <div style={css("font-size:12.5px;color:var(--muted);margin-top:4px;line-height:1.35")}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- 3. What buyers say (auto-scrolling ticker) ---------------- */}
      <section style={css("margin-top:48px")}>
        <h2 style={css(HEADING)}>What buyers say about Commonplace.</h2>
        <style>{"@keyframes cpTicker{from{transform:translateX(0)}to{transform:translateX(-50%)}}.cp-ticker{animation:cpTicker 40s linear infinite}.cp-ticker:hover{animation-play-state:paused}.cp-ticker-mask{-webkit-mask-image:linear-gradient(90deg,transparent,#000 4%,#000 96%,transparent)}"}</style>
        <div className="cp-ticker-mask" style={css("overflow:hidden;position:relative")}>
          <div className="cp-ticker" style={css("display:flex;gap:16px;width:max-content")}>
            {[...TESTIMONIALS, ...TESTIMONIALS].map((t, i) => (
              <div key={i} style={css("width:340px;flex:0 0 auto;background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:18px;display:flex;flex-direction:column")}>
                <div style={css("display:flex;gap:2px;margin-bottom:11px")}>
                  {[0, 1, 2, 3, 4].map((j) => <Star key={j} size={15} />)}
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
        </div>
      </section>

      {/* ---------------- 4. Questions, answered (centered) ---------------- */}
      <section style={css("margin-top:48px;text-align:center")}>
        <h2 style={sx(HEADING, "text-align:center")}>Questions, answered.</h2>
        <div style={css("border-top:1px solid var(--line);max-width:760px;margin:0 auto;text-align:left")}>
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
        <h2 style={css("font-family:'Reckless','Newsreader',serif;font-size:30px;font-weight:500;color:var(--ink);margin-bottom:20px")}>Why Commonplace?</h2>
        <div style={css("display:grid;grid-template-columns:repeat(4,1fr);gap:18px")} data-pe-videos>
          {VIDEOS.map((v) => (
            <Hoverable
              key={v.id}
              as="div"
              onClick={() => openVideo(v.id)}
              styles={sx("cursor:pointer;position:relative;width:100%;aspect-ratio:3/4;border-radius:18px;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end", { background: `linear-gradient(160deg, ${v.from} 0%, ${v.to} 100%)` })}
              hover="transform:translateY(-3px);box-shadow:0 16px 34px rgba(60,10,35,.22)"
            >
              {/* Raw video in the centre strip; the brand-color card shows on the sides. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`https://img.youtube.com/vi/${v.id}/hqdefault.jpg`} alt={v.title} loading="lazy"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                style={css("position:absolute;top:0;bottom:0;left:50%;transform:translateX(-50%);width:66%;height:100%;object-fit:cover")} />
              {/* Bottom scrim only — keeps the title/description legible without tinting the video. */}
              <div style={css("position:absolute;left:0;right:0;bottom:0;height:55%;background:linear-gradient(to top, rgba(0,0,0,.62), rgba(0,0,0,0))")} />
              {/* Centered play button */}
              <span style={css("position:absolute;top:44%;left:50%;transform:translate(-50%,-50%);width:58px;height:58px;border-radius:50%;background:rgba(255,255,255,.24);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center")}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" style={css("margin-left:3px")}><path d="M6 4l14 8-14 8z" /></svg>
              </span>
              {/* Title + description pinned to the bottom */}
              <div style={css("position:relative;padding:20px 18px 20px;background:linear-gradient(to top, rgba(0,0,0,.34), rgba(0,0,0,0))")}>
                <div style={css("font-size:16px;font-weight:800;color:#fff;line-height:1.25;margin-bottom:7px")}>{v.title}</div>
                <div style={css("font-size:12.5px;color:rgba(255,255,255,.9);line-height:1.45")}>{v.desc}</div>
              </div>
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
