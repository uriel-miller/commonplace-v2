"use client";

import { useState } from "react";
import { css, sx, Hoverable } from "@/lib/design/css";
import { formatPrice } from "@/lib/listing";
import { useCart } from "./CartProvider";

/**
 * Slide-out side-cart matching the live trycommonplace.com drawer
 * (woocommerce-sidecart-plugin): 460px panel, line items, promo, totals,
 * Pay-Now / Pay-at-Delivery ($1) cards, maroon Checkout pill.
 */
export function SideCart({ open, onClose, onCheckout }: {
  open: boolean;
  onClose: () => void;
  onCheckout: (mode: "later" | "full") => void;
}) {
  const { items, subtotalCents, remove, updateQty } = useCart();
  const [payMode, setPayMode] = useState<"later" | "full">("later");
  const [promo, setPromo] = useState("");

  return (
    <div style={sx("position:fixed;inset:0;z-index:300;pointer-events:none", { visibility: open ? "visible" : "hidden" })}>
      {/* Scrim */}
      <div onClick={onClose} style={sx("position:absolute;inset:0;background:rgba(25,12,18,.45);transition:opacity .25s", { opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none" })} />
      {/* Panel */}
      <div style={sx("position:absolute;top:0;right:0;height:100dvh;width:460px;max-width:94vw;background:#fff;box-shadow:-16px 0 48px rgba(60,10,35,.18);display:flex;flex-direction:column;transition:transform .28s cubic-bezier(.4,0,.2,1);pointer-events:auto", { transform: open ? "translateX(0)" : "translateX(100%)" })}>
        {/* Header */}
        <div style={css("display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid #E6E6E6")}>
          <div style={css("font-size:19px;font-weight:700;color:#1a1a1a")}>Cart</div>
          <div onClick={onClose} style={css("width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer")}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#4D4D4D" strokeWidth={2}><path d="M6 6l12 12M18 6 6 18" /></svg>
          </div>
        </div>

        {/* Items */}
        <div style={css("flex:1;overflow-y:auto;padding:8px 22px")}>
          {items.length === 0 ? (
            <div style={css("text-align:center;color:#4D4D4D;padding:60px 10px;font-size:15px")}>Your cart is empty</div>
          ) : (
            items.map(({ listing, qty }) => (
              <div key={listing.id} style={css("display:flex;gap:13px;padding:16px 0;border-bottom:1px solid #EDEDEC")}>
                <div style={css("width:60px;height:60px;flex:0 0 auto;border-radius:8px;overflow:hidden;background:#f3efe9")}>
                  {listing.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={listing.images[0]} alt="" style={css("width:100%;height:100%;object-fit:cover")} />
                  ) : null}
                </div>
                <div style={css("flex:1;min-width:0")}>
                  <div style={css("font-size:13.5px;font-weight:500;color:#1a1a1a;line-height:1.3;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical")}>{listing.title}</div>
                  <div style={css("display:flex;align-items:center;gap:8px;margin-top:6px")}>
                    <div style={css("display:flex;align-items:center;border:1px solid #E6E6E6;border-radius:7px")}>
                      <span onClick={() => updateQty(listing.id, qty - 1)} style={css("padding:2px 9px;cursor:pointer;color:#4D4D4D;font-size:15px")}>−</span>
                      <span style={css("padding:2px 6px;font-size:12.5px;min-width:16px;text-align:center")}>{qty}</span>
                      <span onClick={() => updateQty(listing.id, qty + 1)} style={css("padding:2px 9px;cursor:pointer;color:#4D4D4D;font-size:15px")}>+</span>
                    </div>
                    <span onClick={() => remove(listing.id)} style={css("font-size:12px;color:#4D4D4D;cursor:pointer;text-decoration:underline")}>Remove</span>
                  </div>
                </div>
                <div style={css("font-size:14px;font-weight:600;color:#1a1a1a;white-space:nowrap")}>{formatPrice(listing.priceCents)}</div>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div style={css("border-top:1px solid #E6E6E6;padding:16px 22px 20px")}>
            {/* Promo */}
            <div style={css("margin-bottom:14px")}>
              <div style={css("font-size:12px;font-weight:600;color:#4D4D4D;margin-bottom:6px")}>Promo code</div>
              <div style={css("display:flex;gap:8px")}>
                <input value={promo} onChange={(e) => setPromo(e.target.value)} placeholder="Enter" style={css("flex:1;border:1px solid #E6E6E6;border-radius:8px;padding:10px 12px;font-size:13px;outline:none")} />
                <button style={css("border:1px solid #630E3D;background:#fff;color:#630E3D;border-radius:8px;padding:0 16px;font-size:13px;font-weight:600;cursor:pointer")}>Add</button>
              </div>
            </div>
            {/* Totals */}
            <div style={css("display:flex;justify-content:space-between;font-size:13px;color:#4D4D4D;margin-bottom:6px")}><span>Shipping</span><span>Calculated at checkout</span></div>
            <div style={css("display:flex;justify-content:space-between;font-size:16px;font-weight:700;color:#1a1a1a;margin-bottom:14px")}><span>Total</span><span>{formatPrice(subtotalCents)}</span></div>
            {/* Pay mode cards */}
            <div style={css("display:flex;gap:10px;margin-bottom:14px")}>
              <PayCard label="PAY NOW" sub={formatPrice(subtotalCents)} active={payMode === "full"} onClick={() => setPayMode("full")} />
              <PayCard label="PAY AT DELIVERY" sub="$1" active={payMode === "later"} onClick={() => setPayMode("later")} />
            </div>
            <Hoverable onClick={() => onCheckout(payMode)} styles="width:100%;background:#6B1B45;color:#fff;border:none;border-radius:28px;padding:15px;font-size:15px;font-weight:700;cursor:pointer;text-align:center" hover="filter:brightness(1.08)">
              Checkout
            </Hoverable>
          </div>
        )}
      </div>
    </div>
  );
}

function PayCard({ label, sub, active, onClick }: { label: string; sub: string; active: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} style={sx("flex:1;border-radius:10px;padding:12px 10px;cursor:pointer;text-align:center;transition:all .15s",
      active ? { border: "2px solid #630E3D", background: "#fbf3f7" } : { border: "1px solid #E6E6E6", background: "#fff" })}>
      <div style={css("font-size:10.5px;font-weight:700;letter-spacing:.03em;color:#4D4D4D")}>{label}</div>
      <div style={sx("font-size:16px;font-weight:800;margin-top:3px", { color: active ? "#630E3D" : "#1a1a1a" })}>{sub}</div>
    </div>
  );
}
