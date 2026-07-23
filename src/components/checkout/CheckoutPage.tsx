"use client";

import { useState } from "react";
import { css, sx, Hoverable } from "@/lib/design/css";
import { formatPrice } from "@/lib/listing";
import { depositBreakdown, quoteDelivery } from "@/lib/fees";
import { ChevronLeft, Pin } from "@/components/marketplace/icons";
import { useCart, type CartItem } from "@/components/cart/CartProvider";

// Mirror of orders.PLACEHOLDER_DISTANCE_MI (kept local so this client bundle
// never imports the server-only orders module for one constant).
const PLACEHOLDER_DISTANCE_MI = 45;

export interface CheckoutPageProps {
  /** Back to the cart. */
  onBack?: () => void;
  /** Back to browsing (breadcrumb / empty state). */
  onBrowse?: () => void;
  /** After a successful reservation — open order tracking for the new order. */
  onViewOrder?: (orderId: string) => void;
}

interface CheckoutResult {
  ok: boolean;
  orderId?: string;
  dueTodayCents?: number;
  balanceCents?: number;
  manualWire?: boolean;
  error?: string;
}

function formatUsdCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function toLineInput(item: CartItem) {
  return {
    listingId: item.listing.id,
    title: item.listing.title,
    image: item.listing.images[0] ?? null,
    priceCents: item.listing.priceCents,
    qty: item.qty,
    categorySlug: item.listing.categorySlug,
  };
}

/* ------------------------------- summary row ------------------------------- */
function SummaryRow({
  label,
  value,
  sub,
  strong,
}: {
  label: string;
  value: string;
  sub?: string;
  strong?: boolean;
}) {
  return (
    <div style={css("display:flex;align-items:flex-start;justify-content:space-between;gap:12px")}>
      <div>
        <div style={sx("font-size:14px", strong ? "font-weight:800;color:var(--ink)" : "color:var(--muted)")}>{label}</div>
        {sub && <div style={css("font-size:11.5px;color:var(--muted);line-height:1.4;margin-top:1px")}>{sub}</div>}
      </div>
      <div style={sx("white-space:nowrap", strong ? "font-size:16px;font-weight:800;letter-spacing:-.3px" : "font-size:14px;font-weight:700;color:var(--ink)")}>{value}</div>
    </div>
  );
}

/* ---------------------------- confirmation view ---------------------------- */
function Confirmation({
  result,
  onViewOrder,
  onBrowse,
}: {
  result: CheckoutResult;
  onViewOrder?: (id: string) => void;
  onBrowse?: () => void;
}) {
  return (
    <div style={css("max-width:560px;margin:20px auto;text-align:center;padding:8px 20px")}>
      <div style={css("width:78px;height:78px;margin:0 auto 20px;border-radius:50%;background:var(--green,#1f7a4d);display:flex;align-items:center;justify-content:center")}>
        <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>
      <h1 style={css("font-family:'Newsreader',serif;font-size:30px;font-weight:500;letter-spacing:-.4px;line-height:1.1;margin-bottom:8px")}>You’re reserved</h1>
      <p style={css("color:var(--muted);font-size:14.5px;line-height:1.55;margin-bottom:6px")}>
        {formatUsdCents(result.dueTodayCents ?? 100)} charged today. We’ll schedule white-glove delivery — you pay the {formatPrice(result.balanceCents ?? 0)} balance only after you inspect it at home.
      </p>
      {result.manualWire && (
        <p style={css("color:var(--maroon);font-size:12.5px;font-weight:700;line-height:1.5;margin-bottom:6px")}>
          Premium order — our team will contact you to arrange a secure wire for the balance.
        </p>
      )}
      {result.orderId && (
        <div style={css("font-size:12px;color:var(--muted);margin-top:10px")}>
          Order <span style={css("font-family:ui-monospace,'SF Mono',Menlo,monospace;color:var(--ink);font-weight:700")}>{result.orderId.slice(0, 8).toUpperCase()}</span>
        </div>
      )}
      <div style={css("display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:22px")}>
        {result.orderId && onViewOrder && (
          <Hoverable
            as="button"
            type="button"
            onClick={() => onViewOrder(result.orderId as string)}
            styles="background:var(--maroon);color:#fff;border:none;border-radius:12px;padding:13px 22px;font-size:14.5px;font-weight:800;cursor:pointer;font-family:inherit"
            hover="filter:brightness(1.08)"
          >
            Track my order
          </Hoverable>
        )}
        {onBrowse && (
          <Hoverable
            as="button"
            type="button"
            onClick={onBrowse}
            styles="background:var(--paper);color:var(--ink);border:1px solid var(--line);border-radius:12px;padding:13px 22px;font-size:14.5px;font-weight:800;cursor:pointer;font-family:inherit"
            hover="background:var(--putty)"
          >
            Keep browsing
          </Hoverable>
        )}
      </div>
    </div>
  );
}

/* -------------------------------- checkout --------------------------------- */
export function CheckoutPage({ onBack, onBrowse, onViewOrder }: CheckoutPageProps) {
  const { items, count, subtotalCents, hydrated, clear } = useCart();
  const [name, setName] = useState("");
  const [deliverCity, setDeliverCity] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckoutResult | null>(null);

  const { dueTodayCents, dueOnDeliveryCents, manualWire } = depositBreakdown(subtotalCents);
  const quote = quoteDelivery({ distanceMi: PLACEHOLDER_DISTANCE_MI });

  async function reserve() {
    if (submitting || items.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map(toLineInput),
          buyer: { name: name.trim() || undefined, deliverCity: deliverCity.trim() || undefined },
        }),
      });
      const data = (await res.json()) as CheckoutResult;
      if (!res.ok || !data.ok || !data.orderId) {
        setError(data.error || "We couldn’t reserve your order. Please try again.");
        return;
      }
      clear();
      setResult(data);
    } catch {
      setError("Network hiccup — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!hydrated) {
    return (
      <div style={css("max-width:1040px;padding:60px 20px;text-align:center;color:var(--muted);font-size:14px")}>
        Loading checkout…
      </div>
    );
  }

  if (result) {
    return (
      <div style={css("max-width:1040px")}>
        <Confirmation result={result} onViewOrder={onViewOrder} onBrowse={onBrowse} />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div style={css("max-width:1040px")}>
        <div style={css("max-width:520px;margin:40px auto;text-align:center;padding:20px")}>
          <h2 style={css("font-family:'Newsreader',serif;font-size:26px;font-weight:500;letter-spacing:-.4px;margin-bottom:6px")}>Nothing to check out</h2>
          <p style={css("color:var(--muted);font-size:14px;line-height:1.55;margin-bottom:20px")}>Your cart is empty — add something you love, then reserve it for $1.</p>
          {onBrowse && (
            <Hoverable
              as="button"
              type="button"
              onClick={onBrowse}
              styles="background:var(--maroon);color:#fff;border:none;border-radius:12px;padding:13px 24px;font-size:14.5px;font-weight:800;cursor:pointer;font-family:inherit"
              hover="filter:brightness(1.08)"
            >
              Start browsing
            </Hoverable>
          )}
        </div>
      </div>
    );
  }

  const inputStyle =
    "width:100%;box-sizing:border-box;background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:11px 12px;font-size:14px;font-family:inherit;color:var(--ink)";

  return (
    <div style={css("max-width:1040px")}>
      {/* Breadcrumb */}
      <div style={css("display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:12px")}>
        {onBack && (
          <Hoverable as="a" onClick={onBack} styles="color:var(--blueInk);font-weight:600;cursor:pointer;display:flex;align-items:center;gap:4px" hover="color:var(--maroon)">
            <ChevronLeft stroke="currentColor" />Cart
          </Hoverable>
        )}
        <span style={css("color:var(--muted)")}>/ Checkout</span>
      </div>

      <div style={css("margin-bottom:18px")}>
        <h1 style={css("font-family:'Newsreader',serif;font-size:30px;font-weight:500;letter-spacing:-.4px;line-height:1.1")}>Checkout</h1>
        <p style={css("color:var(--muted);font-size:13px;margin-top:2px")}>{count} item{count === 1 ? "" : "s"} · pay just $1 today</p>
      </div>

      <div style={css("display:grid;grid-template-columns:1.4fr 1fr;gap:22px;align-items:start")}>
        {/* Left: buyer details + reassurance */}
        <div style={css("display:flex;flex-direction:column;gap:14px")}>
          <div style={css("background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:18px")}>
            <div style={css("font-size:15px;font-weight:800;margin-bottom:14px")}>Your details</div>
            <div style={css("display:flex;flex-direction:column;gap:12px")}>
              <label style={css("display:flex;flex-direction:column;gap:5px")}>
                <span style={css("font-size:12.5px;font-weight:700;color:var(--ink)")}>Name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Who's this order for?"
                  style={css(inputStyle)}
                />
              </label>
              <label style={css("display:flex;flex-direction:column;gap:5px")}>
                <span style={css("font-size:12.5px;font-weight:700;color:var(--ink)")}>Delivery city <span style={css("color:var(--muted);font-weight:500")}>(optional)</span></span>
                <input
                  value={deliverCity}
                  onChange={(e) => setDeliverCity(e.target.value)}
                  placeholder="City, ST"
                  style={css(inputStyle)}
                />
              </label>
            </div>
          </div>

          <div style={css("display:flex;align-items:center;gap:13px;background:#F9AEB7;border:1px solid #f2939e;border-radius:12px;padding:12px 16px")}>
            <span style={css("width:34px;height:34px;flex:0 0 auto;border-radius:50%;background:var(--maroon);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px")}>$1</span>
            <div style={css("font-size:13px;line-height:1.45")}>
              <b>Reserve for $1 today.</b> We deliver white-glove and only charge the balance after you’ve inspected everything at home — cancel anytime before delivery.
            </div>
          </div>
        </div>

        {/* Right: order summary + reserve CTA */}
        <div style={css("position:sticky;top:6px;display:flex;flex-direction:column;gap:12px")}>
          <div style={css("background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:18px")}>
            <div style={css("font-size:16px;font-weight:800;margin-bottom:14px")}>Order summary</div>

            <div style={css("display:flex;flex-direction:column;gap:11px")}>
              <SummaryRow label={`Subtotal (${count} item${count === 1 ? "" : "s"})`} value={formatPrice(subtotalCents)} />
              <SummaryRow
                label="Delivery & install"
                sub={quote.message}
                value={quote.free ? "FREE" : formatPrice(quote.extraCents)}
              />
            </div>

            <div style={css("height:1px;background:var(--line);margin:14px 0")} />

            <div style={css("display:flex;flex-direction:column;gap:12px")}>
              <SummaryRow label="Due today" sub="A $1 deposit reserves your order" value={formatUsdCents(dueTodayCents)} strong />
              <SummaryRow
                label={manualWire ? "Balance by wire" : "Rest on delivery"}
                sub={manualWire ? "Premium order — arranged by secure wire" : "Charged only after you inspect at home"}
                value={formatPrice(dueOnDeliveryCents)}
              />
            </div>

            {manualWire && (
              <div style={css("margin-top:12px;background:var(--tint,#f6ecec);border:1px solid var(--line);border-radius:10px;padding:11px 12px;font-size:12px;line-height:1.5;color:var(--maroon)")}>
                <b>Premium order.</b> Orders of $8,000+ are collected by manual wire, not auto-charged. Our team will reach out with secure wire details after you reserve.
              </div>
            )}

            {error && (
              <div style={css("margin-top:12px;background:#fdecec;border:1px solid #f3b7b7;border-radius:10px;padding:10px 12px;font-size:12.5px;line-height:1.45;color:#a11")}>
                {error}
              </div>
            )}

            <Hoverable
              as="button"
              type="button"
              onClick={reserve}
              aria-disabled={submitting}
              styles={sx(
                "width:100%;margin-top:16px;background:var(--maroon);color:#fff;border:none;border-radius:12px;padding:14px;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px",
                submitting ? "opacity:.6;cursor:progress" : "",
              )}
              hover={submitting ? undefined : "filter:brightness(1.08)"}
            >
              {submitting ? "Reserving…" : "Reserve for $1"}
            </Hoverable>

            <div style={css("display:flex;align-items:center;justify-content:center;gap:6px;margin-top:10px;font-size:11.5px;color:var(--muted)")}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
              Secure checkout · cancel anytime before delivery
            </div>
          </div>

          {deliverCity.trim() && (
            <div style={css("display:flex;align-items:center;gap:7px;font-size:12px;color:var(--muted);padding:0 4px")}>
              <Pin size={13} />Delivering to {deliverCity.trim()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
