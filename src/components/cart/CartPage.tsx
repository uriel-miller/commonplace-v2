"use client";

import { useState } from "react";
import { css, sx, Hoverable } from "@/lib/design/css";
import { formatPrice, type Listing } from "@/lib/listing";
import { useCart, type CartItem } from "./CartProvider";

/**
 * Full cart page — a faithful port of the live trycommonplace.com /cart/
 * (Shoptimizer WooCommerce) view. Shoppers land here after adding an item.
 *
 * Live layout reproduced 1:1:
 *  - "Cart" heading (52px), left column of minimalist line-item rows + coupon.
 *  - Right summary column (plain rows, no card): Subtotal, Shipment/Delivery
 *    with the deliver-to address + "Change address", the blue "Request this
 *    item" fee-saver callout (#9FCAFB / #273699), the $1 Deposit line, Total,
 *    plum "Proceed to checkout" (6px radius, lock), express pay + trust badges.
 *
 * Robust by construction: every value is guarded (missing images, empty cart,
 * NaN prices, unhydrated store) so nothing here can throw to the shopper.
 */

export interface CartPageProps {
  onBrowse?: () => void;
  onCheckout?: () => void;
  onOpenProduct?: (listing: Listing) => void;
  /** Deliver-to line (city/address). Falls back to a generic prompt. */
  deliverTo?: string;
  /** Opens the location picker to change the delivery address. */
  onChangeAddress?: () => void;
  /** Opens the "request this item near me" flow. */
  onRequestItem?: (listing: Listing) => void;
}

/* ------------------------------- Line item ------------------------------- */
function CartLine({ item, onOpen, first }: { item: CartItem; onOpen?: () => void; first: boolean }) {
  const { updateQty, remove } = useCart();
  const { listing, qty } = item;
  const img = listing.images?.[0];
  const price = Number.isFinite(listing.priceCents) ? listing.priceCents : 0;

  return (
    <div style={sx("display:flex;align-items:center;gap:14px;padding:18px 4px", !first && "border-top:1px solid var(--line)")}>
      {/* Remove */}
      <Hoverable
        as="button"
        type="button"
        aria-label={`Remove ${listing.title}`}
        title="Remove"
        onClick={() => remove(listing.id)}
        styles="width:26px;height:26px;flex:0 0 auto;border:none;background:transparent;border-radius:6px;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;color:var(--muted)"
        hover="background:var(--putty);color:var(--red)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M10 11v6M14 11v6" /></svg>
      </Hoverable>

      {/* Thumb */}
      <div onClick={onOpen} style={sx("width:52px;height:52px;flex:0 0 auto;border-radius:8px;overflow:hidden;background:repeating-linear-gradient(135deg,#EDE4D6 0 10px,#E5DACA 10px 20px)", onOpen ? "cursor:pointer" : "")}>
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="" loading="lazy" style={css("width:100%;height:100%;object-fit:cover")} />
        ) : null}
      </div>

      {/* Title */}
      <Hoverable as="div" onClick={onOpen}
        styles={sx("flex:1;min-width:0;font-size:15px;font-weight:600;color:var(--ink);line-height:1.35", onOpen ? "cursor:pointer" : "")}
        hover={onOpen ? "color:var(--maroon)" : undefined}>
        {listing.title}
      </Hoverable>

      {/* Qty */}
      <div style={css("display:inline-flex;align-items:center;border:1px solid #dcdcdc;border-radius:5px;overflow:hidden;flex:0 0 auto")}>
        <Hoverable as="span" onClick={() => updateQty(listing.id, qty - 1)} styles="padding:5px 10px;cursor:pointer;color:var(--muted);font-size:15px;user-select:none" hover="background:var(--putty)">−</Hoverable>
        <span style={css("padding:5px 4px;min-width:26px;text-align:center;font-size:14px;color:var(--ink)")}>{qty}</span>
        <Hoverable as="span" onClick={() => updateQty(listing.id, qty + 1)} styles="padding:5px 10px;cursor:pointer;color:var(--muted);font-size:15px;user-select:none" hover="background:var(--putty)">+</Hoverable>
      </div>

      {/* Price */}
      <div style={css("font-size:15px;font-weight:600;color:var(--ink);white-space:nowrap;min-width:92px;text-align:right")}>{formatPrice(price * qty)}</div>
    </div>
  );
}

/* ------------------------------- Summary row ------------------------------- */
function Row({ label, value, strong, muted }: { label: React.ReactNode; value: React.ReactNode; strong?: boolean; muted?: boolean }) {
  return (
    <div style={css("display:flex;align-items:baseline;justify-content:space-between;gap:14px")}>
      <span style={sx(strong ? "font-size:18px;font-weight:700;color:var(--ink)" : "font-size:15px;color:var(--ink)", muted && "color:var(--muted)")}>{label}</span>
      <span style={sx(strong ? "font-size:18px;font-weight:800;color:var(--ink)" : "font-size:15px;font-weight:600;color:var(--ink);white-space:nowrap", muted && "color:var(--muted);font-weight:400")}>{value}</span>
    </div>
  );
}

/* ------------------------------- Cart page ------------------------------- */
export function CartPage({ onBrowse, onCheckout, onOpenProduct, deliverTo, onChangeAddress, onRequestItem }: CartPageProps) {
  const { items, count, subtotalCents, dueTodayCents, dueOnDeliveryCents, hydrated } = useCart();
  const [coupon, setCoupon] = useState("");
  const [couponMsg, setCouponMsg] = useState<string | null>(null);

  const due = Number.isFinite(dueTodayCents) ? dueTodayCents : 100;
  const balance = Number.isFinite(dueOnDeliveryCents) ? dueOnDeliveryCents : Math.max(0, subtotalCents - due);

  if (!hydrated) {
    return <div style={css("max-width:1120px;margin:0 auto;padding:60px 20px;text-align:center;color:var(--muted);font-size:14px")}>Loading your cart…</div>;
  }

  const Heading = (
    <h1 style={css("font-family:'Roobert','Inter Tight',sans-serif;font-size:clamp(34px,5vw,52px);font-weight:500;letter-spacing:-.5px;color:var(--ink);margin-bottom:22px")}>Cart</h1>
  );

  if (!items || items.length === 0) {
    return (
      <div style={css("max-width:1120px;margin:0 auto;padding:34px 22px 80px")}>
        {Heading}
        <div style={css("padding:56px 24px;text-align:center;color:var(--muted)")}>
          <div style={css("font-size:16px;margin-bottom:18px")}>Your cart is currently empty.</div>
          <Hoverable as="button" onClick={onBrowse}
            styles="background:var(--maroon);color:#fff;border:none;border-radius:6px;padding:13px 26px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit"
            hover="filter:brightness(1.08)">
            Return to shop
          </Hoverable>
        </div>
      </div>
    );
  }

  function applyCoupon() {
    const code = coupon.trim();
    if (!code) return;
    setCouponMsg(`“${code}” will be validated at checkout.`);
  }

  return (
    <div style={css("max-width:1120px;margin:0 auto;padding:34px 22px 90px")}>
      {Heading}

      <div style={css("display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:48px;align-items:start")} data-cart-grid>
        {/* ---------------- Left: items + coupon ---------------- */}
        <div>
          <div style={css("display:flex;flex-direction:column")}>
            {items.map((item, i) => (
              <CartLine key={item.listing.id} item={item} first={i === 0}
                onOpen={onOpenProduct ? () => onOpenProduct(item.listing) : undefined} />
            ))}
          </div>

          {/* Coupon */}
          <div style={css("margin-top:22px;display:flex;gap:10px;max-width:360px")}>
            <input value={coupon} onChange={(e) => { setCoupon(e.target.value); setCouponMsg(null); }} placeholder="Coupon code"
              style={css("flex:1;border:1px solid #d6d6d6;border-radius:4px;padding:11px 13px;font-size:14px;outline:none;font-family:inherit;color:var(--ink)")} />
            <Hoverable as="button" onClick={applyCoupon}
              styles="border:1px solid #d6d6d6;background:#fff;color:var(--ink);border-radius:4px;padding:0 18px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap"
              hover="background:var(--putty)">Apply coupon</Hoverable>
          </div>
          {couponMsg && <div style={css("font-size:12.5px;color:var(--green);margin-top:8px")}>{couponMsg}</div>}
        </div>

        {/* ---------------- Right: summary ---------------- */}
        <div style={css("display:flex;flex-direction:column;gap:16px")}>
          <Row label="Subtotal" value={formatPrice(subtotalCents)} />

          <div style={css("height:1px;background:var(--line)")} />

          {/* Shipment */}
          <div>
            <div style={css("font-size:15px;font-weight:700;color:var(--ink);margin-bottom:10px")}>Shipment</div>
            <div style={css("display:flex;align-items:center;gap:9px")}>
              <span style={css("width:15px;height:15px;flex:0 0 auto;border-radius:50%;border:4px solid var(--maroon);box-shadow:inset 0 0 0 2px #fff")} />
              <span style={css("flex:1;font-size:15px;font-weight:600;color:var(--ink)")}>Delivery:</span>
              <span style={css("font-size:15px;font-weight:600;color:var(--ink)")}>Calculated at checkout</span>
            </div>
            <div style={css("font-size:13.5px;color:var(--ink);margin-top:10px;line-height:1.5")}>
              {deliverTo ? <>Shipping to <b>{deliverTo}</b>.</> : "Add your delivery address at checkout."}
            </div>
            {onChangeAddress && (
              <Hoverable as="span" onClick={onChangeAddress} styles="display:inline-block;margin-top:4px;font-size:13.5px;color:var(--ink);text-decoration:underline;cursor:pointer" hover="color:var(--maroon)">Change address</Hoverable>
            )}
          </div>

          {/* Blue "Request this item" fee-saver callout */}
          <div style={css("background:#9FCAFB;border:0.75px solid #7FB4F0;border-radius:14px;padding:15px 16px;display:flex;flex-direction:column;gap:12px")}>
            <div style={css("font-size:14px;line-height:1.4;color:#0f1b3d")}>Delivery fee too high? We&apos;ll find you this item near you and save you delivery fees.</div>
            <Hoverable as="button" type="button"
              onClick={() => { if (onRequestItem && items[0]) onRequestItem(items[0].listing); }}
              styles="align-self:flex-start;background:#273699;color:#fff;border:none;border-radius:999px;padding:10px 20px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit"
              hover="filter:brightness(1.1)">Request this item</Hoverable>
          </div>

          {/* Deposit + Total */}
          <Row label="Deposit ($1.00):" value={<span style={css("color:var(--green)")}>−{formatPrice(Math.max(0, subtotalCents - due))}</span>} muted />
          <div style={css("height:1px;background:var(--line)")} />
          <Row label="Total" value={formatPrice(due)} strong />
          <div style={css("font-size:12.5px;color:var(--muted);line-height:1.5;margin-top:-4px")}>
            Reserve for {formatPrice(due)} today — the remaining {formatPrice(balance)} (item + delivery) is charged only after you inspect it at home.
          </div>

          {/* Proceed to checkout */}
          <Hoverable as="button" type="button" onClick={onCheckout}
            styles="width:100%;margin-top:4px;background:var(--maroon);color:#fff;border:none;border-radius:6px;padding:15px;font-size:16px;font-weight:600;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:9px"
            hover="filter:brightness(1.08)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
            Proceed to checkout
          </Hoverable>

          {/* Express pay */}
          <div style={css("text-align:center;font-size:13px;color:var(--muted);margin:2px 0")}>— or —</div>
          <Hoverable as="button" type="button" onClick={onCheckout}
            styles="width:100%;background:#2b2b31;color:#fff;border:none;border-radius:6px;padding:14px;font-size:14.5px;font-weight:600;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:9px"
            hover="filter:brightness(1.15)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}><rect x="2" y="5" width="20" height="14" rx="2.5" /><path d="M2 10h20" /></svg>
            Debit or Credit Card
          </Hoverable>
          <Hoverable as="button" type="button" onClick={onCheckout}
            styles="width:100%;background:#000;color:#fff;border:none;border-radius:6px;padding:14px;font-size:14.5px;font-weight:600;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:6px"
            hover="filter:brightness(1.4)">
            Checkout with&nbsp;<span style={css("font-weight:700")}>G&nbsp;Pay</span>
          </Hoverable>

          {/* Trust badges */}
          <div style={css("display:flex;align-items:center;justify-content:center;gap:14px;margin-top:8px;flex-wrap:wrap;opacity:.85")}>
            <span style={css("display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:var(--muted)")}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
              100% SECURE
            </span>
            <span style={css("font-size:12px;font-weight:800;color:#1a1f71")}>VISA</span>
            <span style={css("font-size:12px;font-weight:800;color:#eb001b")}>Master<span style={css("color:#f79e1b")}>card</span></span>
            <span style={css("font-size:12px;font-weight:800;color:#003087")}>Pay<span style={css("color:#009cde")}>Pal</span></span>
          </div>
        </div>
      </div>

      <style>{"@media(max-width:860px){[data-cart-grid]{grid-template-columns:1fr!important;gap:32px!important}}"}</style>
    </div>
  );
}

export default CartPage;
