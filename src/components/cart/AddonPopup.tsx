"use client";

import { useState } from "react";
import { css, sx, Hoverable } from "@/lib/design/css";
import { formatPrice } from "@/lib/listing";
import { useCart } from "./CartProvider";
import { addonsForCategories, addonToListing, type Addon } from "@/lib/addons";
import { warrantyTotalCents, warrantyRenewalMonthlyCents } from "@/lib/warranty";
import { AddonIcon } from "./AddonIcon";

/**
 * In-cart add-on pop-up — Shopify-style upsell. Offers category-specific
 * protection plans + accessories for whatever is in the cart (warranties always;
 * accessories matched to the cart's categories, with a generic fallback).
 *
 * Each add-on is a product-style card with its own "+ Add" button that drops it
 * straight into the cart (and flips to "✓ Added"); protection plans behave as a
 * single choice (adding one swaps out any other). Fully fail-soft.
 */
export function AddonPopup({
  open,
  categorySlugs,
  basisCents = 0,
  onClose,
}: {
  open: boolean;
  categorySlugs: Array<string | null | undefined>;
  basisCents?: number;
  onClose: () => void;
}) {
  const { add, remove } = useCart();
  // Track added add-ons by key so the buttons reflect cart state.
  const [added, setAdded] = useState<Set<string>>(new Set());

  let addons: Addon[] = [];
  try {
    addons = addonsForCategories(categorySlugs).map((a) =>
      // Warranty amount is 12 months priced from the item (2%/mo), not a stale flat fee.
      a.kind === "warranty" && basisCents > 0
        ? { ...a, title: "12-Month Warranty", priceCents: warrantyTotalCents(basisCents, 12), blurb: `Full parts & labor for 12 months, then optional ${formatPrice(warrantyRenewalMonthlyCents(basisCents))}/mo.` }
        : a,
    );
  } catch { addons = []; }
  const services = addons.filter((a) => a.kind === "service");
  const warranties = addons.filter((a) => a.kind === "warranty");
  const accessories = addons.filter((a) => a.kind === "accessory");

  if (!open || addons.length === 0) return null;

  const addedTotal = addons.filter((a) => added.has(a.key)).reduce((s, a) => s + a.priceCents, 0);
  const addedCount = added.size;

  function toggle(a: Addon) {
    try {
      const listing = addonToListing(a);
      if (added.has(a.key)) {
        remove(listing.id);
        setAdded((prev) => { const n = new Set(prev); n.delete(a.key); return n; });
        return;
      }
      // Protection plans are single-choice — remove any other selected plan first.
      if (a.kind === "warranty") {
        for (const w of warranties) {
          if (w.key !== a.key && added.has(w.key)) {
            try { remove(addonToListing(w).id); } catch { /* ignore */ }
          }
        }
      }
      add(listing);
      setAdded((prev) => {
        const n = new Set(prev);
        if (a.kind === "warranty") for (const w of warranties) n.delete(w.key);
        n.add(a.key);
        return n;
      });
    } catch {
      /* a single bad add-on can never break the pop-up */
    }
  }

  return (
    <div role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={css("position:fixed;inset:0;z-index:400;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(25,12,18,.72);animation:cmpAddonFade .18s ease-out")}>
      <style>{"@keyframes cmpAddonFade{from{opacity:0}to{opacity:1}}@keyframes cmpAddonScale{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}"}</style>
      <div role="dialog" aria-modal="true" aria-label="Add protection and accessories"
        style={css("position:relative;width:100%;max-width:780px;max-height:92vh;overflow-y:auto;background:var(--paper);border-radius:20px;box-shadow:0 30px 80px rgba(0,0,0,.35);animation:cmpAddonScale .2s cubic-bezier(.16,1,.3,1)")}>
        {/* Header */}
        <div style={css("position:sticky;top:0;background:var(--paper);border-bottom:1px solid var(--line);padding:20px 24px;z-index:1")}>
          <button type="button" aria-label="Close" onClick={onClose}
            style={css("position:absolute;top:16px;right:16px;width:32px;height:32px;border:0;border-radius:50%;background:#F0EDE8;color:#555;cursor:pointer;font-size:16px;line-height:1")}>×</button>
          <h2 style={css("font-family:'Reckless','Newsreader',serif;font-size:23px;font-weight:600;color:var(--ink);margin-bottom:3px")}>Complete your setup</h2>
          <p style={css("font-size:13.5px;color:var(--muted)")}>Add protection and accessories, delivered with your order.</p>
        </div>

        <div style={css("padding:18px 20px 8px")}>
          {services.length > 0 && (
            <div style={css("margin-bottom:20px")}>
              <div style={css("font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-bottom:10px")}>Recommended services</div>
              <div style={css("display:flex;flex-direction:column;gap:10px")}>
                {services.map((s) => (
                  <Card key={s.key} addon={s} added={added.has(s.key)} onToggle={() => toggle(s)} />
                ))}
              </div>
            </div>
          )}
          {warranties.length > 0 && (
            <div style={css("margin-bottom:20px")}>
              <div style={css("font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-bottom:10px")}>Protection plans</div>
              {basisCents > 0
                ? <WarrantyBlock basisCents={basisCents} />
                : <div style={css("display:flex;flex-direction:column;gap:10px")}>{warranties.map((w) => (<Card key={w.key} addon={w} added={added.has(w.key)} onToggle={() => toggle(w)} />))}</div>}
            </div>
          )}

          {accessories.length > 0 && (
            <div style={css("margin-bottom:8px")}>
              <div style={css("font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-bottom:10px")}>Accessories</div>
              <div style={css("display:flex;flex-direction:column;gap:10px")}>
                {accessories.map((a) =>
                  (a.key === "acc-peloton-shoes" || /\bshoe/i.test(a.title))
                    ? <ShoeCard key={a.key} addon={a} />
                    : <Card key={a.key} addon={a} added={added.has(a.key)} onToggle={() => toggle(a)} />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={css("position:sticky;bottom:0;background:var(--paper);border-top:1px solid var(--line);padding:16px 24px;display:flex;align-items:center;gap:12px")}>
          <div style={css("flex:1;min-width:0")}>
            {addedCount > 0
              ? <div style={css("font-size:13.5px;color:var(--ink)")}><b>{addedCount}</b> added · <b>{formatPrice(addedTotal)}</b></div>
              : <div style={css("font-size:13px;color:var(--muted)")}>Tap “Add” to include an item</div>}
          </div>
          <Hoverable as="button" onClick={onClose}
            styles={sx("border:none;border-radius:28px;padding:13px 26px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;color:#fff", { background: "var(--maroon)" })}
            hover="filter:brightness(1.08)">
            {addedCount > 0 ? "Done" : "No thanks"}
          </Hoverable>
        </div>
      </div>
    </div>
  );
}

/* --------------------- Shopify-style product card --------------------- */
function Card({ addon, added, onToggle }: { addon: Addon; added: boolean; onToggle: () => void }) {
  return (
    <div style={sx("display:flex;align-items:center;gap:13px;padding:12px;border-radius:14px;transition:border-color .14s",
      added ? { border: "1.5px solid var(--maroon)", background: "#fbf3f7" } : { border: "1px solid var(--line)", background: "var(--paper)" })}>
      {/* Distinct per-item icon */}
      <AddonIcon title={addon.title} kind={addon.kind} size={54} image={addon.image} />

      {/* Details */}
      <div style={css("flex:1;min-width:0")}>
        <div style={css("display:flex;align-items:baseline;gap:8px")}>
          <span style={css("font-size:14.5px;font-weight:700;color:var(--ink)")}>{addon.title}</span>
          <span style={css("font-size:14px;font-weight:800;color:var(--ink);white-space:nowrap")}>+{formatPrice(addon.priceCents)}</span>
        </div>
        <div style={css("font-size:12.5px;color:var(--muted);line-height:1.4;margin-top:2px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical")}>{addon.blurb}</div>
      </div>

      {/* Add / Added button */}
      <Hoverable as="button" onClick={onToggle}
        styles={sx("flex:0 0 auto;border-radius:22px;padding:9px 18px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:5px;transition:all .14s",
          added ? { background: "var(--maroon)", color: "#fff", border: "1px solid var(--maroon)" } : { background: "var(--paper)", color: "var(--maroon)", border: "1.5px solid var(--maroon)" })}
        hover={added ? "filter:brightness(1.08)" : "background:#fbf3f7"}>
        {added ? (
          <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>Added</>
        ) : (
          <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>Add</>
        )}
      </Hoverable>
    </div>
  );
}

/* --------- Peloton shoes: pick an EU size before adding to cart --------- */
const SHOE_SIZES = ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46", "47"];
function ShoeCard({ addon }: { addon: Addon }) {
  const { add, remove, items } = useCart();
  const [size, setSize] = useState("");
  const shoeItem = items.find((it) => typeof it.listing.slug === "string" && it.listing.slug.startsWith("acc-peloton-shoes"));
  const addShoe = () => { if (!size) return; add(addonToListing({ ...addon, key: `acc-peloton-shoes-eu${size}`, title: `${addon.title} · EU ${size}` })); setSize(""); };
  return (
    <div style={sx("display:flex;flex-direction:column;gap:10px;padding:12px;border-radius:14px", shoeItem ? { border: "1.5px solid var(--maroon)", background: "#fbf3f7" } : { border: "1px solid var(--line)", background: "var(--paper)" })}>
      <div style={css("display:flex;align-items:center;gap:13px")}>
        <AddonIcon title={addon.title} kind={addon.kind} size={54} image={addon.image} />
        <div style={css("flex:1;min-width:0")}>
          <div style={css("display:flex;align-items:baseline;gap:8px")}>
            <span style={css("font-size:14.5px;font-weight:700;color:var(--ink)")}>{addon.title}</span>
            <span style={css("font-size:14px;font-weight:800;color:var(--ink)")}>+{formatPrice(addon.priceCents)}</span>
          </div>
          <div style={css("font-size:12.5px;color:var(--muted);line-height:1.4;margin-top:2px")}>{shoeItem ? shoeItem.listing.title : addon.blurb}</div>
        </div>
        {shoeItem && (
          <Hoverable as="button" onClick={() => remove(shoeItem.listing.id)} styles={sx("flex:0 0 auto;border-radius:22px;padding:9px 18px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit", { background: "var(--maroon)", color: "#fff", border: "1px solid var(--maroon)" })} hover="filter:brightness(1.08)">✓ Added</Hoverable>
        )}
      </div>
      {!shoeItem && (
        <div>
          <div style={css("font-size:11.5px;font-weight:700;color:var(--muted);margin-bottom:6px")}>Choose a size (EU)</div>
          <div style={css("display:flex;flex-wrap:wrap;gap:6px;align-items:center")}>
            {SHOE_SIZES.map((s) => (
              <div key={s} onClick={() => setSize(s)} style={sx("padding:6px 11px;border-radius:9px;font-size:12.5px;font-weight:700;cursor:pointer;transition:all .14s", size === s ? { background: "var(--blueBg)", color: "var(--blueInk)", border: "1px solid var(--blueInk)" } : { background: "var(--paper)", color: "var(--ink)", border: "1px solid var(--line)" })}>{s}</div>
            ))}
            <Hoverable as="button" onClick={addShoe} styles={sx("margin-left:auto;border-radius:22px;padding:9px 18px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit", size ? { background: "var(--paper)", color: "var(--maroon)", border: "1.5px solid var(--maroon)" } : { background: "var(--putty)", color: "var(--muted)", border: "1px solid var(--line)", cursor: "default" })} hover={size ? "background:#fbf3f7" : ""}>+ Add</Hoverable>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Warranty block: term picker + coverage overview ---------------- */
const WARRANTY_COVERAGE: string[] = [
  "Full parts & labor — diagnostics, replacement parts and repair labor at no cost while covered.",
  "Handled by our vetted local technician network — no shipping the item anywhere.",
  "Mechanical & electrical failures from normal use, including motors, electronics and moving parts.",
  "Transferable if you sell the item, and cancellable anytime with no penalty.",
];

function WarrantyBlock({ basisCents }: { basisCents: number }) {
  const { add, remove, items } = useCart();
  const [term, setTerm] = useState<6 | 12 | 18>(12);
  const [renew, setRenew] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);

  const warrantyItem = items.find((it) => typeof it.listing.slug === "string" && it.listing.slug.startsWith("war-ext-"));
  const added = !!warrantyItem;
  const wMo = warrantyRenewalMonthlyCents(basisCents);
  const termPrice = (t: 6 | 12 | 18) => warrantyTotalCents(basisCents, t);
  const build = (t: 6 | 12 | 18, r: boolean): Addon => ({
    key: `war-ext-${t}${r ? "-r" : ""}`, kind: "warranty",
    title: `${t}-Month Warranty${r ? " + auto-renew" : ""}`,
    blurb: r ? `Prepaid ${t}-month coverage, then ${formatPrice(wMo)}/mo (billed after your term).` : `Prepaid ${t}-month coverage.`,
    priceCents: termPrice(t),
  });
  const reAdd = (t: 6 | 12 | 18, r: boolean) => { if (warrantyItem) { remove(warrantyItem.listing.id); add(addonToListing(build(t, r))); } };
  const pickTerm = (t: 6 | 12 | 18) => { setTerm(t); reAdd(t, renew); };
  const toggleRenew = () => { const nv = !renew; setRenew(nv); reAdd(term, nv); };
  const toggleAdd = () => { if (warrantyItem) remove(warrantyItem.listing.id); else add(addonToListing(build(term, renew))); };
  const TERMS: [6 | 12 | 18, string][] = [[6, "6 mo"], [12, "12 mo"], [18, "18 mo"]];

  return (
    <div style={sx("border-radius:14px;padding:14px", added ? { border: "1.5px solid var(--maroon)", background: "#fbf3f7" } : { border: "1px solid var(--line)", background: "var(--paper)" })}>
      <div style={css("display:flex;align-items:center;gap:12px")}>
        <AddonIcon title="Extended Warranty" kind="warranty" size={48} />
        <div style={css("flex:1;min-width:0")}>
          <div style={css("display:flex;align-items:baseline;gap:8px;flex-wrap:wrap")}>
            <span style={css("font-size:14.5px;font-weight:700;color:var(--ink)")}>Extended Warranty</span>
            <span style={css("font-size:14px;font-weight:800;color:var(--ink)")}>+{formatPrice(termPrice(term))}</span>
          </div>
          <div onClick={() => setShowPolicy((v) => !v)} style={css("display:inline-flex;align-items:center;gap:4px;font-size:13.5px;font-weight:700;color:var(--blueInk);cursor:pointer;margin-top:3px")}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
            What&apos;s covered {showPolicy ? "▲" : "▼"}
          </div>
        </div>
        <Hoverable as="button" onClick={toggleAdd}
          styles={sx("flex:0 0 auto;border-radius:22px;padding:9px 18px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit", added ? { background: "var(--maroon)", color: "#fff", border: "1px solid var(--maroon)" } : { background: "var(--paper)", color: "var(--maroon)", border: "1.5px solid var(--maroon)" })}
          hover={added ? "filter:brightness(1.08)" : "background:#fbf3f7"}>
          {added ? "✓ Added" : "+ Add"}
        </Hoverable>
      </div>

      {/* Coverage overview (click to expand) */}
      {showPolicy && (
        <div style={css("margin-top:12px;padding:12px 14px;background:var(--putty);border-radius:11px")}>
          <div style={css("font-size:13.5px;font-weight:800;color:var(--ink);margin-bottom:9px")}>Your protection plan covers</div>
          <div style={css("display:flex;flex-direction:column;gap:9px")}>
            {WARRANTY_COVERAGE.map((c) => (
              <div key={c} style={css("display:flex;gap:9px;font-size:14px;color:var(--ink);line-height:1.5")}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" style={css("flex:0 0 auto;margin-top:1px")}><path d="M20 6 9 17l-5-5" /></svg>
                <span>{c}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plan-length options */}
      <div style={css("display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;padding-left:60px")}>
        {TERMS.map(([t, label]) => {
          const on = term === t;
          return (
            <div key={t} onClick={() => pickTerm(t)} style={sx("display:flex;flex-direction:column;align-items:center;gap:1px;padding:7px 13px;border-radius:11px;cursor:pointer;transition:all .14s;min-width:72px", on ? { background: "var(--blueBg)", color: "var(--blueInk)", border: "1px solid var(--blueInk)" } : { background: "var(--paper)", color: "var(--ink)", border: "1px solid var(--line)" })}>
              <span style={css("font-size:12.5px;font-weight:700")}>{label}</span>
              <span style={css("font-size:11px;opacity:.75")}>{formatPrice(termPrice(t))} upfront</span>
            </div>
          );
        })}
      </div>

      {/* Optional month-to-month continuation */}
      <div onClick={toggleRenew} role="checkbox" aria-checked={renew} tabIndex={0}
        style={css("display:flex;align-items:flex-start;gap:9px;margin-top:10px;margin-left:60px;padding:9px 11px;border-radius:11px;cursor:pointer;background:var(--putty)")}>
        <div style={sx("width:18px;height:18px;flex:0 0 auto;border-radius:5px;margin-top:1px;display:flex;align-items:center;justify-content:center", renew ? { background: "var(--maroon)", border: "1px solid var(--maroon)" } : { background: "var(--paper)", border: "1.5px solid var(--line)" })}>
          {renew && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
        </div>
        <div style={css("font-size:12px;color:var(--ink);line-height:1.4")}>
          <b>Continue month-to-month after my term</b> <span style={css("color:var(--muted)")}>(optional)</span> — {formatPrice(wMo)}/mo. Sign up now, first charge only after your {term}-month term expires. Cancel anytime.
        </div>
      </div>
    </div>
  );
}

export default AddonPopup;
