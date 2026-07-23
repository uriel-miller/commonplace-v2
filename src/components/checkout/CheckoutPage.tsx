"use client";

import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { css, sx, Hoverable } from "@/lib/design/css";
import { formatPrice, type Listing } from "@/lib/listing";
import { depositBreakdown, quoteDelivery, DEPOSIT_CENTS } from "@/lib/fees";
import { ChevronLeft, Chevron } from "@/components/marketplace/icons";
import { useCart, type CartItem } from "@/components/cart/CartProvider";

// Mirror of orders.PLACEHOLDER_DISTANCE_MI (kept local so this client bundle
// never imports the server-only orders module for one constant).
const PLACEHOLDER_DISTANCE_MI = 45;

// Live checkout font stack (Shoptimizer-child self-hosted Roobert Medium).
const FONT = "'Roobert',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";

// Exact live hexes from the .cpco checkout template.
const MAROON = "#630E3D";
const MAROON_HOVER = "#4a0a2d";
const INK = "#1a1a1a";
const SECONDARY = "#4D4D4D";
const PLACEHOLDER = "#808080";
const CARD_BORDER = "#E6E6E6";
const INPUT_BORDER = "#EDEDEC";
const ROW_BORDER = "#F2F2F2";
const ERROR_RED = "#D4183D";

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL",
  "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT",
  "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI",
  "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC",
];

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

type PayMode = "now" | "later";

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

/* ------------------------------ section title ------------------------------ */
function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 style={css(`font-family:${FONT};font-size:20px;font-weight:500;color:${INK};margin:0 0 14px`)}>
      {children}
    </h3>
  );
}

/* --------------------------------- inputs ---------------------------------- */
const INPUT_BASE =
  `width:100%;box-sizing:border-box;height:48px;background:#fff;border:1px solid ${INPUT_BORDER};border-radius:8px;padding:0 14px;font-size:16px;font-weight:500;font-family:${FONT};color:${INK};outline:none`;

function TextField({
  value,
  onChange,
  placeholder,
  type = "text",
  autoComplete,
  inputMode,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  autoComplete?: string;
  inputMode?: "text" | "email" | "tel" | "numeric";
}) {
  const [focused, setFocused] = useState(false);
  const focusStyle = focused ? "border:1px solid #666;box-shadow:0 0 0 4px rgba(58,165,255,.20)" : "";
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      autoComplete={autoComplete}
      inputMode={inputMode}
      style={sx(INPUT_BASE, focusStyle)}
    />
  );
}

function StateSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [focused, setFocused] = useState(false);
  const focusStyle = focused ? "border:1px solid #666;box-shadow:0 0 0 4px rgba(58,165,255,.20)" : "";
  return (
    <div style={css("position:relative;width:100%")}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={sx(
          INPUT_BASE,
          "appearance:none;-webkit-appearance:none;padding-right:38px;cursor:pointer",
          value ? "" : `color:${PLACEHOLDER}`,
          focusStyle,
        )}
      >
        <option value="" disabled>State</option>
        {US_STATES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <span style={css("position:absolute;top:50%;right:14px;transform:translateY(-50%);pointer-events:none;display:flex")}>
        <Chevron size={16} stroke={SECONDARY} />
      </span>
    </div>
  );
}

/* ------------------------------- totals row -------------------------------- */
function TotalRow({
  label,
  value,
  muted,
  valueStyle,
  labelStyle,
}: {
  label: ReactNode;
  value: ReactNode;
  muted?: boolean;
  valueStyle?: CSSProperties;
  labelStyle?: CSSProperties;
}) {
  return (
    <div style={css("display:flex;align-items:baseline;justify-content:space-between;gap:12px")}>
      <span style={sx(`font-size:15px;font-weight:500;color:${muted ? SECONDARY : INK}`, labelStyle)}>{label}</span>
      <span style={sx(`font-size:15px;font-weight:500;color:${muted ? SECONDARY : INK};white-space:nowrap`, valueStyle)}>{value}</span>
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
            styles={`background:${MAROON};color:#fff;border:none;border-radius:100px;padding:14px 26px;font-size:14.5px;font-weight:600;cursor:pointer;font-family:${FONT}`}
            hover={`background:${MAROON_HOVER}`}
          >
            Track my order
          </Hoverable>
        )}
        {onBrowse && (
          <Hoverable
            as="button"
            type="button"
            onClick={onBrowse}
            styles={`background:#fff;color:${INK};border:1px solid ${CARD_BORDER};border-radius:100px;padding:14px 26px;font-size:14.5px;font-weight:600;cursor:pointer;font-family:${FONT}`}
            hover="background:#f7f7f7"
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
  const { items, subtotalCents, hydrated, remove, clear } = useCart();
  const gridClass = useId().replace(/[:]/g, "");

  // Contact
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  // Shipping
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  // Controls
  const [payMethod, setPayMethod] = useState<"card" | "paypal">("card");
  const [billingSame, setBillingSame] = useState(true);
  const [terms, setTerms] = useState(true);
  const [payMode, setPayMode] = useState<PayMode>("later");
  const [promoOpen, setPromoOpen] = useState(false);
  const [promo, setPromo] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckoutResult | null>(null);

  const quote = quoteDelivery({ distanceMi: PLACEHOLDER_DISTANCE_MI });
  const deliveryCents = quote.free ? 0 : quote.extraCents;
  const fullTotalCents = subtotalCents + deliveryCents;

  const { dueTodayCents, manualWire } = depositBreakdown(subtotalCents);
  const dueAtDeliveryCents = Math.max(0, fullTotalCents - dueTodayCents);

  async function placeOrder() {
    if (submitting || items.length === 0) return;
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    if (!terms) {
      setError("Please agree to the Terms and Conditions to continue.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const deliverCity = [city.trim(), state].filter(Boolean).join(", ");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map(toLineInput),
          buyer: {
            name: fullName || undefined,
            deliverCity: deliverCity || undefined,
          },
        }),
      });
      const data = (await res.json()) as CheckoutResult;
      if (!res.ok || !data.ok || !data.orderId) {
        setError(data.error || "We couldn’t place your order. Please try again.");
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

  /* ------------------------------ gate states ------------------------------ */
  if (!hydrated) {
    return (
      <div style={css(`max-width:1060px;padding:60px 20px;text-align:center;color:${SECONDARY};font-size:14px;font-family:${FONT}`)}>
        Loading checkout…
      </div>
    );
  }

  if (result) {
    return (
      <div style={css(`max-width:1060px;font-family:${FONT}`)}>
        <Confirmation result={result} onViewOrder={onViewOrder} onBrowse={onBrowse} />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div style={css(`max-width:1060px;font-family:${FONT}`)}>
        <div style={css("max-width:520px;margin:40px auto;text-align:center;padding:20px")}>
          <h2 style={css("font-family:'Newsreader',serif;font-size:26px;font-weight:500;letter-spacing:-.4px;margin-bottom:6px")}>Nothing to check out</h2>
          <p style={css(`color:${SECONDARY};font-size:14px;line-height:1.55;margin-bottom:20px`)}>Your cart is empty — add something you love, then reserve it for $1.</p>
          {onBrowse && (
            <Hoverable
              as="button"
              type="button"
              onClick={onBrowse}
              styles={`background:${MAROON};color:#fff;border:none;border-radius:100px;padding:14px 26px;font-size:14.5px;font-weight:600;cursor:pointer;font-family:${FONT}`}
              hover={`background:${MAROON_HOVER}`}
            >
              Start browsing
            </Hoverable>
          )}
        </div>
      </div>
    );
  }

  /* ------------------------------- checkout -------------------------------- */
  const cardShadow = "0 6px 24px rgba(99,14,61,.05)";

  return (
    <div style={css(`max-width:1060px;padding:0 20px;font-family:${FONT};color:${INK}`)}>
      {/* Responsive grid: 1fr / 360px, summary jumps to top ≤780px. */}
      <style>{`
        .${gridClass}{display:grid;grid-template-columns:1fr 360px;gap:20px;align-items:start}
        .${gridClass}>.cpco-right{position:sticky;top:12px}
        @media (max-width:780px){
          .${gridClass}{grid-template-columns:1fr}
          .${gridClass}>.cpco-right{order:-1;position:static}
        }
      `}</style>

      {/* Back link */}
      <Hoverable
        as="button"
        type="button"
        onClick={onBack}
        styles={`background:none;border:none;padding:0;margin:20px 0 18px;display:inline-flex;align-items:center;gap:8px;font-family:${FONT};font-size:20px;font-weight:500;color:${INK};cursor:pointer`}
        hover={`color:${MAROON}`}
      >
        <ChevronLeft stroke="currentColor" size={18} />
        Confirm &amp; Pay
      </Hoverable>

      <div className={gridClass}>
        {/* -------------------------------- LEFT -------------------------------- */}
        <div style={css(`background:#fff;border:1px solid ${CARD_BORDER};border-radius:10px;padding:16px;box-shadow:${cardShadow}`)}>
          {/* Contact */}
          <div style={css("margin-bottom:26px")}>
            <SectionTitle>Contact information</SectionTitle>
            <div style={css("display:flex;flex-direction:column;gap:12px")}>
              <TextField value={email} onChange={setEmail} placeholder="Email" type="email" autoComplete="email" inputMode="email" />
              <TextField value={phone} onChange={setPhone} placeholder="Phone Number" type="tel" autoComplete="tel" inputMode="tel" />
            </div>
          </div>

          {/* Shipping */}
          <div style={css("margin-bottom:26px")}>
            <SectionTitle>Shipping Address</SectionTitle>
            <div style={css("display:flex;flex-direction:column;gap:12px")}>
              <div style={css("display:grid;grid-template-columns:1fr 1fr;gap:12px")}>
                <TextField value={firstName} onChange={setFirstName} placeholder="First Name" autoComplete="given-name" />
                <TextField value={lastName} onChange={setLastName} placeholder="Last Name" autoComplete="family-name" />
              </div>
              <TextField value={address1} onChange={setAddress1} placeholder="Shipping Address" autoComplete="address-line1" />
              <TextField value={address2} onChange={setAddress2} placeholder="Apartment, suite, unit, etc (optional)" autoComplete="address-line2" />
              <div style={css("display:grid;grid-template-columns:1fr 110px 130px;gap:12px")}>
                <TextField value={city} onChange={setCity} placeholder="Town/City" autoComplete="address-level2" />
                <StateSelect value={state} onChange={setState} />
                <TextField value={zip} onChange={setZip} placeholder="ZIP Code" autoComplete="postal-code" inputMode="numeric" />
              </div>
              <div style={css(`font-size:13px;color:${SECONDARY};font-weight:500`)}>Delivering within the United States</div>
            </div>
          </div>

          {/* Payment */}
          <div style={css("margin-bottom:22px")}>
            <SectionTitle>Payment</SectionTitle>
            <div style={css(`border:1px solid ${ROW_BORDER};border-radius:8px;overflow:hidden`)}>
              <PaymentRadio
                label="Card"
                sub="Visa, Mastercard, Amex, Discover"
                selected={payMethod === "card"}
                onSelect={() => setPayMethod("card")}
              />
              <PaymentRadio
                label="PayPal"
                sub="Pay with your PayPal account"
                selected={payMethod === "paypal"}
                onSelect={() => setPayMethod("paypal")}
                last
              />
            </div>
            {manualWire && (
              <div style={css("margin-top:12px;background:#eef4ff;border-radius:8px;padding:12px 14px;font-size:13px;line-height:1.5;color:#1a3b6b")}>
                For orders over $8,000, payment in full is by bank transfer (ACH). Card payment isn’t available for pay-in-full on premium orders — choose <b>Pay Later</b> to place a card deposit instead.
              </div>
            )}
          </div>

          {/* Billing toggle */}
          <label style={css("display:flex;align-items:center;gap:10px;cursor:pointer;margin-bottom:18px")}>
            <CheckBox checked={billingSame} onChange={() => setBillingSame((v) => !v)} />
            <span style={css(`font-size:15px;font-weight:500;color:${INK}`)}>Use shipping address as billing address</span>
          </label>

          {!billingSame && (
            <div style={css("margin-bottom:22px")}>
              <SectionTitle>Billing Address</SectionTitle>
              <div style={css("display:flex;flex-direction:column;gap:12px")}>
                <TextField value={address1} onChange={setAddress1} placeholder="Billing Address" autoComplete="billing address-line1" />
                <div style={css("display:grid;grid-template-columns:1fr 110px 130px;gap:12px")}>
                  <TextField value={city} onChange={setCity} placeholder="Town/City" />
                  <StateSelect value={state} onChange={setState} />
                  <TextField value={zip} onChange={setZip} placeholder="ZIP Code" inputMode="numeric" />
                </div>
              </div>
            </div>
          )}

          {/* Place order */}
          <div style={css(`border-top:1px solid ${ROW_BORDER};padding-top:18px`)}>
            <label style={css("display:flex;align-items:flex-start;gap:10px;cursor:pointer;margin-bottom:16px")}>
              <CheckBox checked={terms} onChange={() => setTerms((v) => !v)} />
              <span style={css(`font-size:15px;font-weight:500;color:${INK};line-height:1.4`)}>
                I agree to the{" "}
                <span style={css(`color:${MAROON};text-decoration:underline`)}>Terms and Conditions</span>
              </span>
            </label>

            {error && (
              <div style={css(`margin-bottom:14px;background:#fdecef;border-left:3px solid ${ERROR_RED};border-radius:6px;padding:11px 13px;font-size:13.5px;line-height:1.45;color:${ERROR_RED}`)}>
                {error}
              </div>
            )}

            <Hoverable
              as="button"
              type="button"
              onClick={placeOrder}
              aria-disabled={submitting}
              styles={sx(
                `width:100%;height:52px;background:${MAROON};color:#fff;border:none;border-radius:100px;font-size:16px;font-weight:600;font-family:${FONT};cursor:pointer;display:flex;align-items:center;justify-content:center`,
                submitting ? "opacity:.65;cursor:progress" : "",
              )}
              hover={submitting ? undefined : `background:${MAROON_HOVER}`}
            >
              {submitting ? "Placing Order…" : "Place Order"}
            </Hoverable>

            <div style={css(`display:flex;align-items:center;justify-content:center;gap:8px;margin-top:14px;font-size:16px;color:${SECONDARY}`)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="5" y="11" width="14" height="9" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
              Your payment information is encrypted and secure
            </div>
          </div>
        </div>

        {/* -------------------------------- RIGHT ------------------------------- */}
        <div className="cpco-right">
          <div style={css(`background:#fff;border:1px solid ${CARD_BORDER};border-radius:10px;padding:20px;box-shadow:${cardShadow}`)}>
            <h3 style={css(`font-family:${FONT};font-size:20px;font-weight:500;color:${INK};margin:0 0 16px`)}>Order Summary</h3>

            {/* Product rows */}
            <div style={css("display:flex;flex-direction:column;gap:16px")}>
              {items.map((item) => (
                <ProductRow key={item.listing.id} listing={item.listing} qty={item.qty} onRemove={() => remove(item.listing.id)} />
              ))}
            </div>

            {/* Promo */}
            <div style={css(`border-top:1px solid ${ROW_BORDER};margin-top:18px;padding-top:14px`)}>
              <Hoverable
                as="button"
                type="button"
                onClick={() => setPromoOpen((v) => !v)}
                styles={`background:none;border:none;padding:0;width:100%;display:flex;align-items:center;justify-content:space-between;cursor:pointer;font-family:${FONT};font-size:15px;font-weight:500;color:${INK}`}
                hover={`color:${MAROON}`}
              >
                Promo code
                <span style={sx("display:flex;transition:transform .2s", promoOpen ? "transform:rotate(180deg)" : "")}>
                  <Chevron size={16} stroke={SECONDARY} />
                </span>
              </Hoverable>
              {promoOpen && (
                <div style={css("display:flex;gap:8px;margin-top:12px")}>
                  <input
                    value={promo}
                    onChange={(e) => setPromo(e.target.value)}
                    placeholder="Enter promo code"
                    style={css(`flex:1;box-sizing:border-box;height:44px;background:#fff;border:1px solid ${INPUT_BORDER};border-radius:8px;padding:0 12px;font-size:15px;font-family:${FONT};color:${INK};outline:none`)}
                  />
                  <Hoverable
                    as="button"
                    type="button"
                    styles={`flex:0 0 auto;height:44px;padding:0 18px;background:${MAROON};color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;font-family:${FONT};cursor:pointer`}
                    hover={`background:${MAROON_HOVER}`}
                  >
                    Apply
                  </Hoverable>
                </div>
              )}
            </div>

            {/* Payment option pill */}
            <div style={css(`border-top:1px solid ${ROW_BORDER};margin-top:14px;padding-top:16px`)}>
              {quote.free && (
                <div style={css("font-size:13px;color:#1f7a4d;font-weight:600;margin-bottom:12px")}>
                  ✓ Free delivery within 100 miles
                </div>
              )}
              <div style={css(`font-size:15px;font-weight:500;color:${INK};margin-bottom:10px`)}>Payment option</div>
              <div style={css("display:flex;background:#F7F7F7;border-radius:100px;padding:4px")}>
                <SegButton label="Pay Now" active={payMode === "now"} onClick={() => setPayMode("now")} />
                <SegButton label="Pay Later" active={payMode === "later"} onClick={() => setPayMode("later")} />
              </div>
            </div>

            {/* Totals */}
            <div style={css(`border-top:1px solid ${ROW_BORDER};margin-top:16px;padding-top:16px;display:flex;flex-direction:column;gap:12px`)}>
              <TotalRow label="Subtotal" value={formatPrice(subtotalCents)} />
              <TotalRow
                label="Delivery"
                value={quote.free ? "Free" : formatPrice(deliveryCents)}
                valueStyle={quote.free ? css("color:#1f7a4d") : undefined}
              />

              <div style={css(`border-top:1px solid ${ROW_BORDER};margin-top:2px;padding-top:12px`)}>
                <TotalRow
                  label="Total"
                  value={formatPrice(fullTotalCents)}
                  labelStyle={css("font-size:17px;font-weight:600")}
                  valueStyle={css("font-size:17px;font-weight:600")}
                />
              </div>

              {payMode === "later" && (
                <div style={css("display:flex;flex-direction:column;gap:12px;margin-top:4px")}>
                  <TotalRow
                    label={<span style={css(`color:${MAROON};font-weight:600`)}>Due Today</span>}
                    value={<span style={css(`color:${MAROON};font-size:24px;font-weight:600;letter-spacing:-.3px`)}>{formatUsdCents(DEPOSIT_CENTS)}</span>}
                  />
                  <TotalRow
                    label={<span style={css(`color:${MAROON};font-weight:500`)}>Due At Delivery</span>}
                    value={<span style={css(`color:${MAROON};font-size:16px;font-weight:600`)}>{formatUsdCents(dueAtDeliveryCents)}</span>}
                  />

                  {manualWire ? (
                    <div style={css("background:#fff3cd;border-radius:8px;padding:12px 14px;font-size:13px;line-height:1.5;color:#5c4a00")}>
                      You’re paying a {formatUsdCents(dueTodayCents)} deposit today by card. The remaining {formatUsdCents(dueAtDeliveryCents)} must be paid by bank wire / transfer before pickup — your card will not be charged automatically. We’ll email you the wire details after your order is confirmed.
                    </div>
                  ) : (
                    <div style={css(`font-size:13px;font-style:italic;text-align:center;line-height:1.5;color:${SECONDARY}`)}>
                      Your card will be securely saved for automatic final charge upon delivery.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ subcomponents ------------------------------ */

function PaymentRadio({
  label,
  sub,
  selected,
  onSelect,
  last,
}: {
  label: string;
  sub: string;
  selected: boolean;
  onSelect: () => void;
  last?: boolean;
}) {
  return (
    <label
      onClick={onSelect}
      style={sx(
        `display:flex;align-items:center;gap:12px;padding:16px;cursor:pointer`,
        last ? "" : `border-bottom:1px solid ${ROW_BORDER}`,
        selected ? "background:#F7F7F7" : "",
      )}
    >
      <span
        style={sx(
          "width:20px;height:20px;flex:0 0 auto;border-radius:50%;box-sizing:border-box;display:flex;align-items:center;justify-content:center;transition:box-shadow .15s",
          selected ? `background:#fff;box-shadow:inset 0 0 0 4px ${MAROON}` : "background:#fff;box-shadow:inset 0 0 0 1.5px #cfcfcf",
        )}
      />
      <span style={css("display:flex;flex-direction:column;gap:2px")}>
        <span style={css(`font-size:15px;font-weight:500;color:${INK}`)}>{label}</span>
        <span style={css(`font-size:12.5px;color:${SECONDARY}`)}>{sub}</span>
      </span>
    </label>
  );
}

function CheckBox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <span
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onClick={onChange}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          onChange();
        }
      }}
      style={sx(
        "width:20px;height:20px;flex:0 0 auto;border-radius:5px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;cursor:pointer;margin-top:1px",
        checked ? `background:${MAROON};border:1px solid ${MAROON}` : `background:#fff;border:1px solid #cfcfcf`,
      )}
    >
      {checked && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      )}
    </span>
  );
}

function SegButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={sx(
        `flex:1;height:40px;border:none;border-radius:100px;font-size:14px;font-weight:600;font-family:${FONT};cursor:pointer`,
        active ? `background:${MAROON};color:#fff` : `background:transparent;color:${SECONDARY}`,
      )}
    >
      {label}
    </button>
  );
}

function ProductRow({ listing, qty, onRemove }: { listing: Listing; qty: number; onRemove: () => void }) {
  const img = listing.images[0] ?? null;
  const lineCents = listing.priceCents * qty;
  const meta = [`${qty}QTY`, listing.location].filter(Boolean).join(" · ");
  return (
    <div style={css("display:flex;gap:12px;align-items:flex-start")}>
      <div style={css(`width:60px;height:60px;flex:0 0 auto;border-radius:8px;overflow:hidden;background:#f2f2f2;border:1px solid ${ROW_BORDER}`)}>
        {img && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={listing.title} loading="lazy" style={css("width:100%;height:100%;object-fit:cover;display:block")} />
        )}
      </div>
      <div style={css("flex:1;min-width:0")}>
        <div style={css(`font-size:15px;font-weight:500;color:${INK};line-height:1.35;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical`)}>
          {listing.title}
        </div>
        <div style={css(`font-size:13px;color:${SECONDARY};margin-top:3px`)}>{meta}</div>
      </div>
      <div style={css("display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex:0 0 auto")}>
        <span style={css(`font-size:16px;font-weight:600;color:${INK};white-space:nowrap`)}>{formatPrice(lineCents)}</span>
        <Hoverable
          as="button"
          type="button"
          onClick={onRemove}
          styles={`background:none;border:none;padding:0;font-size:13px;color:${MAROON};text-decoration:underline;cursor:pointer;font-family:${FONT}`}
          hover={`color:${MAROON_HOVER}`}
        >
          Remove
        </Hoverable>
      </div>
    </div>
  );
}
