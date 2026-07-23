"use client";

import { useMemo, useState } from "react";
import { css, sx, Hoverable } from "@/lib/design/css";
import { formatPrice } from "@/lib/listing";
import { useCart } from "./CartProvider";
import { addonsForCategories, addonToListing, type Addon } from "@/lib/addons";

/**
 * In-cart add-on pop-up — offers category-specific protection plans + accessories
 * for whatever is in the cart (warranties always; accessories matched to the
 * cart's categories, with a generic fallback). Selected add-ons are added to the
 * cart as line items.
 *
 * Robust by construction: bad/empty categories degrade gracefully, the add
 * handler is wrapped so a single failure can't break the rest, and the whole
 * thing renders nothing rather than throwing when there's nothing to offer.
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
  const { add } = useCart();
  const [warranty, setWarranty] = useState<string | null>(null);
  const [acc, setAcc] = useState<Set<string>>(new Set());

  const addons = useMemo(() => {
    try { return addonsForCategories(categorySlugs); } catch { return []; }
  }, [categorySlugs]);

  const warranties = addons.filter((a) => a.kind === "warranty");
  const accessories = addons.filter((a) => a.kind === "accessory");

  const selectedTotal =
    (warranty ? warranties.find((w) => w.key === warranty)?.priceCents ?? 0 : 0) +
    accessories.filter((a) => acc.has(a.key)).reduce((s, a) => s + a.priceCents, 0);
  const selectedCount = (warranty ? 1 : 0) + acc.size;

  if (!open || addons.length === 0) return null;

  function toggleAcc(key: string) {
    setAcc((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function addSelected() {
    try {
      const chosen: Addon[] = [];
      if (warranty) { const w = warranties.find((x) => x.key === warranty); if (w) chosen.push(w); }
      for (const a of accessories) if (acc.has(a.key)) chosen.push(a);
      for (const a of chosen) {
        try { add(addonToListing(a)); } catch { /* one bad add-on can't break the rest */ }
      }
    } finally {
      onClose();
    }
  }

  return (
    <div role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={css("position:fixed;inset:0;z-index:400;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(25,12,18,.72);animation:cmpAddonFade .18s ease-out")}>
      <style>{"@keyframes cmpAddonFade{from{opacity:0}to{opacity:1}}@keyframes cmpAddonScale{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}"}</style>
      <div role="dialog" aria-modal="true" aria-label="Add protection and accessories"
        style={css("position:relative;width:100%;max-width:520px;max-height:88vh;overflow-y:auto;background:var(--paper);border-radius:18px;box-shadow:0 30px 80px rgba(0,0,0,.35);animation:cmpAddonScale .2s cubic-bezier(.16,1,.3,1)")}>
        {/* Header */}
        <div style={css("position:sticky;top:0;background:var(--paper);border-bottom:1px solid var(--line);padding:20px 24px;z-index:1")}>
          <button type="button" aria-label="Close" onClick={onClose}
            style={css("position:absolute;top:16px;right:16px;width:32px;height:32px;border:0;border-radius:50%;background:#F0EDE8;color:#555;cursor:pointer;font-size:16px;line-height:1")}>×</button>
          <h2 style={css("font-family:'Reckless','Newsreader',serif;font-size:23px;font-weight:600;color:var(--ink);margin-bottom:3px")}>Complete your setup</h2>
          <p style={css("font-size:13.5px;color:var(--muted)")}>Add protection and accessories, delivered with your order.</p>
        </div>

        <div style={css("padding:18px 24px 8px")}>
          {/* Warranties */}
          {warranties.length > 0 && (
            <div style={css("margin-bottom:20px")}>
              <div style={css("font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-bottom:10px")}>Protection plans</div>
              {warranties.map((w) => {
                const on = warranty === w.key;
                return (
                  <Row key={w.key} title={w.title} blurb={w.blurb} price={w.priceCents} on={on} shape="radio"
                    onClick={() => setWarranty(on ? null : w.key)} />
                );
              })}
            </div>
          )}

          {/* Accessories */}
          {accessories.length > 0 && (
            <div style={css("margin-bottom:8px")}>
              <div style={css("font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-bottom:10px")}>Accessories</div>
              {accessories.map((a) => (
                <Row key={a.key} title={a.title} blurb={a.blurb} price={a.priceCents} on={acc.has(a.key)} shape="check"
                  onClick={() => toggleAcc(a.key)} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={css("position:sticky;bottom:0;background:var(--paper);border-top:1px solid var(--line);padding:16px 24px;display:flex;align-items:center;gap:12px;flex-wrap:wrap")}>
          <button type="button" onClick={onClose} style={css("background:transparent;border:none;color:var(--muted);font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;text-decoration:underline")}>No thanks</button>
          <div style={css("flex:1")} />
          <Hoverable as="button" onClick={addSelected}
            styles={sx("border:none;border-radius:28px;padding:13px 24px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;color:#fff", selectedCount ? { background: "var(--maroon)" } : { background: "#c9b6bf" })}
            hover="filter:brightness(1.08)">
            {selectedCount ? `Add ${selectedCount} · ${formatPrice(selectedTotal)}` : "Add to cart"}
          </Hoverable>
        </div>
      </div>
    </div>
  );
}

function Row({ title, blurb, price, on, shape, onClick }: {
  title: string; blurb: string; price: number; on: boolean; shape: "radio" | "check"; onClick: () => void;
}) {
  return (
    <Hoverable as="div" onClick={onClick}
      styles={sx("display:flex;align-items:flex-start;gap:12px;padding:13px 14px;border-radius:12px;cursor:pointer;margin-bottom:8px;transition:all .14s",
        on ? { border: "1.5px solid var(--maroon)", background: "#fbf3f7" } : { border: "1px solid var(--line)", background: "var(--paper)" })}
      hover={on ? "" : "border-color:#d9b7c2"}>
      <span style={sx("flex:0 0 auto;width:20px;height:20px;margin-top:1px;display:flex;align-items:center;justify-content:center;border:2px solid", { borderColor: on ? "var(--maroon)" : "#cbb", borderRadius: shape === "radio" ? "50%" : "6px", background: on ? "var(--maroon)" : "transparent" })}>
        {on && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
      </span>
      <div style={css("flex:1;min-width:0")}>
        <div style={css("font-size:14.5px;font-weight:700;color:var(--ink)")}>{title}</div>
        <div style={css("font-size:12.5px;color:var(--muted);line-height:1.4;margin-top:2px")}>{blurb}</div>
      </div>
      <div style={css("font-size:14.5px;font-weight:800;color:var(--ink);white-space:nowrap")}>+{formatPrice(price)}</div>
    </Hoverable>
  );
}

export default AddonPopup;
