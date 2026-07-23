"use client";

import { css, sx, Hoverable } from "@/lib/design/css";
import { formatPrice, type Listing } from "@/lib/listing";
import { Pin, Close, ChevronLeft } from "@/components/marketplace/icons";
import { useCart, type CartItem } from "./CartProvider";

export interface CartPageProps {
  /** Back-to-browsing affordance (breadcrumb + empty-state button). */
  onBrowse?: () => void;
  /** Fires when the buyer taps the checkout CTA. */
  onCheckout?: () => void;
  /** Open a specific listing (line-item title/image click). */
  onOpenProduct?: (listing: Listing) => void;
}

/** Small tile-price formatter with cents, for the "$1 due today" line. */
function formatUsdCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const PROTECTIONS: readonly [string, string, string, string][] = [
  ["FREE white-glove delivery & install", "var(--blueBg)", "var(--blueInk)", "Brought inside, to the room you choose."],
  ["Inspect before you pay a cent", "var(--tint)", "var(--maroon)", "Only $1 today — test it, then pay the rest."],
  ["2-month warranty included", "var(--yellowBg)", "var(--gold)", "Coverage on every order, at no cost."],
  ["Verified sellers, human support", "#efe7f3", "var(--purple)", "Every item vetted; real people on call."],
];

/* ------------------------------- Quantity stepper ------------------------------- */
function QtyStepper({ qty, onDec, onInc }: { qty: number; onDec: () => void; onInc: () => void }) {
  const btn =
    "width:30px;height:30px;flex:0 0 auto;display:flex;align-items:center;justify-content:center;background:var(--paper);border:none;color:var(--ink);cursor:pointer;font-family:inherit;font-size:16px;font-weight:700;line-height:1";
  return (
    <div style={css("display:inline-flex;align-items:center;border:1px solid var(--line);border-radius:9px;overflow:hidden;background:var(--paper)")}>
      <Hoverable as="button" type="button" aria-label="Decrease quantity" onClick={onDec} styles={btn} hover="background:var(--putty)">–</Hoverable>
      <span style={css("min-width:34px;text-align:center;font-size:13.5px;font-weight:700;color:var(--ink)")}>{qty}</span>
      <Hoverable as="button" type="button" aria-label="Increase quantity" onClick={onInc} styles={btn} hover="background:var(--putty)">+</Hoverable>
    </div>
  );
}

/* ------------------------------- Line item ------------------------------- */
function CartLine({ item, onOpen }: { item: CartItem; onOpen?: () => void }) {
  const { updateQty, remove } = useCart();
  const { listing, qty } = item;
  const img = listing.images[0];
  const lineTotal = listing.priceCents * qty;

  return (
    <div style={css("display:flex;gap:14px;background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:12px")}>
      {/* Thumbnail */}
      <div
        onClick={onOpen}
        style={sx(
          "width:96px;height:96px;flex:0 0 auto;border-radius:10px;overflow:hidden;position:relative;background:repeating-linear-gradient(135deg,#EDE4D6 0 12px,#E5DACA 12px 24px)",
          onOpen ? "cursor:pointer" : "",
        )}
      >
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={listing.title} loading="lazy" style={css("position:absolute;inset:0;width:100%;height:100%;object-fit:cover")} />
        ) : (
          <div style={css("position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:8px")}>
            <span style={css("font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:9px;letter-spacing:.1em;color:#9a8c78;text-align:center;text-transform:uppercase")}>{listing.categoryName}</span>
          </div>
        )}
      </div>

      {/* Details */}
      <div style={css("flex:1;min-width:0;display:flex;flex-direction:column")}>
        <div style={css("display:flex;align-items:flex-start;gap:10px")}>
          <Hoverable
            as="div"
            onClick={onOpen}
            styles={sx(
              "flex:1;min-width:0;font-family:'Newsreader',serif;font-size:15px;font-weight:500;line-height:1.25",
              onOpen ? "cursor:pointer" : "",
            )}
            hover={onOpen ? "color:var(--maroon)" : undefined}
          >
            {listing.title}
          </Hoverable>
          <Hoverable
            as="button"
            type="button"
            aria-label={`Remove ${listing.title}`}
            title="Remove"
            onClick={() => remove(listing.id)}
            styles="width:28px;height:28px;flex:0 0 auto;border:none;background:transparent;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0"
            hover="background:var(--putty)"
          >
            <Close size={15} stroke="var(--muted)" />
          </Hoverable>
        </div>

        <div style={css("display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:4px")}>
          {listing.condition && (
            <span style={css("font-size:10.5px;font-weight:700;color:var(--ink);background:var(--putty);border:1px solid var(--line);border-radius:20px;padding:2px 9px")}>{listing.condition}</span>
          )}
          {listing.location && (
            <span style={css("display:flex;align-items:center;gap:3px;font-size:11.5px;color:var(--muted)")}>
              <Pin size={12} />{listing.location}
            </span>
          )}
        </div>

        <div style={css("flex:1")} />

        <div style={css("display:flex;align-items:flex-end;justify-content:space-between;gap:10px;margin-top:10px")}>
          <QtyStepper
            qty={qty}
            onDec={() => updateQty(listing.id, qty - 1)}
            onInc={() => updateQty(listing.id, qty + 1)}
          />
          <div style={css("text-align:right")}>
            <div style={css("font-size:16px;font-weight:800;letter-spacing:-.3px")}>{formatPrice(lineTotal)}</div>
            {qty > 1 && (
              <div style={css("font-size:11px;color:var(--muted);margin-top:1px")}>{formatPrice(listing.priceCents)} each</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- Empty state ------------------------------- */
function EmptyCart({ onBrowse }: { onBrowse?: () => void }) {
  return (
    <div style={css("max-width:520px;margin:40px auto;text-align:center;padding:20px")}>
      <div style={css("width:74px;height:74px;margin:0 auto 18px;border-radius:50%;background:var(--blueBg);display:flex;align-items:center;justify-content:center")}>
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--blueInk)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="21" r="1.4" />
          <circle cx="18" cy="21" r="1.4" />
          <path d="M1 1h3l2.6 12.4a2 2 0 0 0 2 1.6h8.7a2 2 0 0 0 2-1.6L23 6H6" />
        </svg>
      </div>
      <h2 style={css("font-family:'Newsreader',serif;font-size:26px;font-weight:500;letter-spacing:-.4px;margin-bottom:6px")}>Your cart is empty</h2>
      <p style={css("color:var(--muted);font-size:14px;line-height:1.55;margin-bottom:20px")}>
        Reserve anything for just $1 today — we deliver it white-glove, and you only pay the rest once you&apos;ve inspected it at home.
      </p>
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
  );
}

/* ------------------------------- Summary row ------------------------------- */
function SummaryRow({ label, value, sub, strong }: { label: string; value: string; sub?: string; strong?: boolean }) {
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

/* ------------------------------- Cart page ------------------------------- */
export function CartPage({ onBrowse, onCheckout, onOpenProduct }: CartPageProps) {
  const { items, count, subtotalCents, dueTodayCents, dueOnDeliveryCents, hydrated } = useCart();

  // Avoid rendering an empty/populated flash before localStorage is read.
  if (!hydrated) {
    return (
      <div style={css("max-width:1040px;padding:60px 20px;text-align:center;color:var(--muted);font-size:14px")}>
        Loading your cart…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div style={css("max-width:1040px")}>
        {onBrowse && (
          <div style={css("display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:14px")}>
            <Hoverable as="a" onClick={onBrowse} styles="color:var(--blueInk);font-weight:600;cursor:pointer;display:flex;align-items:center;gap:4px" hover="color:var(--maroon)"><ChevronLeft stroke="currentColor" />Browse</Hoverable>
            <span style={css("color:var(--muted)")}>/ Cart</span>
          </div>
        )}
        <EmptyCart onBrowse={onBrowse} />
      </div>
    );
  }

  return (
    <div style={css("max-width:1040px")}>
      {/* Breadcrumb */}
      {onBrowse && (
        <div style={css("display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:12px")}>
          <Hoverable as="a" onClick={onBrowse} styles="color:var(--blueInk);font-weight:600;cursor:pointer;display:flex;align-items:center;gap:4px" hover="color:var(--maroon)"><ChevronLeft stroke="currentColor" />Browse</Hoverable>
          <span style={css("color:var(--muted)")}>/ Cart</span>
        </div>
      )}

      <div style={css("display:flex;align-items:flex-end;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:18px")}>
        <div>
          <h1 style={css("font-family:'Newsreader',serif;font-size:30px;font-weight:500;letter-spacing:-.4px;line-height:1.1")}>Your cart</h1>
          <p style={css("color:var(--muted);font-size:13px;margin-top:2px")}>{count} item{count === 1 ? "" : "s"} reserved · pay just $1 today</p>
        </div>
      </div>

      <div style={css("display:grid;grid-template-columns:1.5fr 1fr;gap:22px;align-items:start")}>
        {/* Line items */}
        <div style={css("display:flex;flex-direction:column;gap:11px")}>
          {items.map((item) => (
            <CartLine
              key={item.listing.id}
              item={item}
              onOpen={onOpenProduct ? () => onOpenProduct(item.listing) : undefined}
            />
          ))}

          {/* $1 model explainer */}
          <div style={css("display:flex;align-items:center;gap:13px;background:#F9AEB7;border:1px solid #f2939e;border-radius:12px;padding:12px 16px;margin-top:2px")}>
            <span style={css("width:34px;height:34px;flex:0 0 auto;border-radius:50%;background:var(--maroon);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px")}>$1</span>
            <div style={css("font-size:13px;line-height:1.45")}>
              <b>Pay $1 upfront · the rest on delivery.</b> Your dollar reserves everything above. We deliver it white-glove and only charge the balance after you&apos;ve inspected it at home — no meetups, no risk.
            </div>
          </div>
        </div>

        {/* Order summary */}
        <div style={css("position:sticky;top:6px;display:flex;flex-direction:column;gap:12px")}>
          <div style={css("background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:18px")}>
            <div style={css("font-size:16px;font-weight:800;margin-bottom:14px")}>Order summary</div>

            <div style={css("display:flex;flex-direction:column;gap:11px")}>
              <SummaryRow label={`Subtotal (${count} item${count === 1 ? "" : "s"})`} value={formatPrice(subtotalCents)} />
              <SummaryRow label="Delivery & install" value="FREE" />
            </div>

            <div style={css("height:1px;background:var(--line);margin:14px 0")} />

            <div style={css("display:flex;flex-direction:column;gap:12px")}>
              <SummaryRow label="Due today" sub="A $1 deposit reserves your order" value={formatUsdCents(dueTodayCents)} strong />
              <SummaryRow label="Rest on delivery" sub="Charged only after you inspect at home" value={formatPrice(dueOnDeliveryCents)} />
            </div>

            <Hoverable
              as="button"
              type="button"
              onClick={onCheckout}
              styles="width:100%;margin-top:16px;background:var(--maroon);color:#fff;border:none;border-radius:12px;padding:14px;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px"
              hover="filter:brightness(1.08)"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="18" height="14" rx="2.5" />
                <path d="M3 10h18" />
              </svg>
              Checkout · pay $1 today
            </Hoverable>

            <div style={css("display:flex;align-items:center;justify-content:center;gap:6px;margin-top:10px;font-size:11.5px;color:var(--muted)")}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
              Secure checkout · cancel anytime before delivery
            </div>
          </div>

          {/* Protections */}
          <div style={css("background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:16px")}>
            <div style={css("font-size:14px;font-weight:800;margin-bottom:11px")}>Every order is protected</div>
            <div style={css("display:flex;flex-direction:column;gap:9px")}>
              {PROTECTIONS.map(([title, bg, fg, blurb]) => (
                <div key={title} style={css("display:flex;gap:10px;align-items:flex-start")}>
                  <span style={sx("width:26px;height:26px;flex:0 0 auto;border-radius:8px;display:flex;align-items:center;justify-content:center", { background: bg, color: fg })}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6}><path d="M20 6 9 17l-5-5" /></svg>
                  </span>
                  <div style={css("min-width:0")}>
                    <div style={css("font-size:12.5px;font-weight:700;line-height:1.25")}>{title}</div>
                    <div style={css("font-size:11.5px;color:var(--muted);line-height:1.4;margin-top:1px")}>{blurb}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
