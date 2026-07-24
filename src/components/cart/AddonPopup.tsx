"use client";

import { useState } from "react";
import { css, sx, Hoverable } from "@/lib/design/css";
import { formatPrice } from "@/lib/listing";
import { useCart } from "./CartProvider";
import { addonsForCategories, addonToListing, type Addon } from "@/lib/addons";

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
  onClose,
}: {
  open: boolean;
  categorySlugs: Array<string | null | undefined>;
  onClose: () => void;
}) {
  const { add, remove } = useCart();
  // Track added add-ons by key so the buttons reflect cart state.
  const [added, setAdded] = useState<Set<string>>(new Set());

  let addons: Addon[] = [];
  try { addons = addonsForCategories(categorySlugs); } catch { addons = []; }
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
        style={css("position:relative;width:100%;max-width:540px;max-height:88vh;overflow-y:auto;background:var(--paper);border-radius:18px;box-shadow:0 30px 80px rgba(0,0,0,.35);animation:cmpAddonScale .2s cubic-bezier(.16,1,.3,1)")}>
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
              <div style={css("display:flex;flex-direction:column;gap:10px")}>
                {warranties.map((w) => (
                  <Card key={w.key} addon={w} added={added.has(w.key)} onToggle={() => toggle(w)} />
                ))}
              </div>
            </div>
          )}

          {accessories.length > 0 && (
            <div style={css("margin-bottom:8px")}>
              <div style={css("font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-bottom:10px")}>Accessories</div>
              <div style={css("display:flex;flex-direction:column;gap:10px")}>
                {accessories.map((a) => (
                  <Card key={a.key} addon={a} added={added.has(a.key)} onToggle={() => toggle(a)} />
                ))}
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
  const tile =
    addon.kind === "warranty" ? { background: "var(--tint)", color: "var(--maroon)" }
    : addon.kind === "service" ? { background: "var(--greenBg)", color: "var(--green)" }
    : { background: "var(--blueBg)", color: "var(--blueInk)" };
  return (
    <div style={sx("display:flex;align-items:center;gap:13px;padding:12px;border-radius:14px;transition:border-color .14s",
      added ? { border: "1.5px solid var(--maroon)", background: "#fbf3f7" } : { border: "1px solid var(--line)", background: "var(--paper)" })}>
      {/* Thumbnail tile */}
      <div style={sx("width:54px;height:54px;flex:0 0 auto;border-radius:11px;display:flex;align-items:center;justify-content:center", tile)}>
        {addon.kind === "warranty" ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>
        ) : addon.kind === "service" ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M20.6 8.4 12 3 3.4 8.4 12 13.8l8.6-5.4Z" /><path d="M3.4 8.4V15.6L12 21l8.6-5.4V8.4" /><path d="M12 13.8V21" /></svg>
        )}
      </div>

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

export default AddonPopup;
