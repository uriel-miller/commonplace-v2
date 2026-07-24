"use client";

// Buyer dashboard — the offers the buyer has placed and the orders on their way,
// rebuilt in the new marketplace design language (Reckless-serif headings, paper
// cards, plum accents) to match AccountPage. Data comes from the getBuyingData()
// server function; every failure degrades to a real empty state, never a throw.

import { useEffect, useState } from "react";
import { css, sx, Hoverable } from "@/lib/design/css";
import { formatPrice } from "@/lib/listing";
import { getBuyingData } from "@/lib/dashboards";
import type { BuyingData, DashboardOrder, OfferDTO } from "@/lib/dashboards";
import type { OfferStatus } from "@/lib/offers";

const EMPTY: BuyingData = {
  offers: [],
  orders: [],
  stats: { activeOffers: 0, accepted: 0, arriving: 0 },
};

const GRADIENT = "repeating-linear-gradient(135deg,#EDE4D6 0 10px,#E5DACA 10px 20px)";

/* Offer status → pill palette, matching the marketplace status chips. */
function statusPill(status: OfferDTO["status"]): { bg: string; color: string; label: string } {
  switch (status) {
    case "accepted":
      return { bg: "var(--greenBg)", color: "var(--green)", label: "Accepted" };
    case "countered":
      return { bg: "var(--yellowBg)", color: "var(--gold)", label: "Countered" };
    case "declined":
      return { bg: "#F5EAE7", color: "var(--red)", label: "Declined" };
    default:
      return { bg: "var(--blueBg)", color: "var(--blueInk)", label: "Pending" };
  }
}

/* Order status → pill palette + label. */
function orderStatusLabel(status: string): { bg: string; color: string; label: string } {
  switch (status) {
    case "scheduled":
      return { bg: "var(--blueBg)", color: "var(--blueInk)", label: "Scheduled" };
    case "picked_up":
      return { bg: "var(--yellowBg)", color: "var(--gold)", label: "Picked up" };
    case "in_transit":
      return { bg: "var(--yellowBg)", color: "var(--gold)", label: "In transit" };
    case "delivered":
      return { bg: "var(--greenBg)", color: "var(--green)", label: "Delivered" };
    case "paid":
      return { bg: "var(--greenBg)", color: "var(--green)", label: "Paid" };
    case "cancelled":
      return { bg: "#F5EAE7", color: "var(--red)", label: "Cancelled" };
    default:
      return { bg: "var(--putty)", color: "var(--muted)", label: "Reserved" };
  }
}

/* Deterministic progress fraction + fill color for an order's pipeline stage. */
function orderProgress(status: string): { pct: number; color: string } {
  switch (status) {
    case "cancelled":
      return { pct: 100, color: "var(--red)" };
    case "paid":
    case "delivered":
      return { pct: 100, color: "var(--maroon)" };
    case "in_transit":
      return { pct: 80, color: "var(--blue)" };
    case "picked_up":
      return { pct: 55, color: "var(--blue)" };
    case "scheduled":
      return { pct: 30, color: "var(--blue)" };
    default:
      return { pct: 12, color: "var(--blue)" };
  }
}

/** Human ETA line for an order, guarded to degrade to null when nothing useful. */
function orderEta(o: DashboardOrder): string | null {
  const city = typeof o.deliverCity === "string" && o.deliverCity.trim() ? o.deliverCity.trim() : null;
  switch (o.status) {
    case "in_transit":
      return city ? `On the way to ${city}` : "On the way";
    case "picked_up":
      return city ? `Picked up · heading to ${city}` : "Picked up";
    case "scheduled":
      return city ? `Scheduled for delivery to ${city}` : "Delivery scheduled";
    case "delivered":
      return city ? `Delivered to ${city}` : "Delivered";
    case "paid":
      return "Paid in full";
    case "cancelled":
      return "Order cancelled";
    default:
      return city ? `Reserved · delivering to ${city}` : null;
  }
}

/** Compact relative time ("2h ago") from an ISO timestamp. */
function timeAgo(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const secs = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function Thumb({ src, size = 62 }: { src: string | null; size?: number }) {
  const dim = `${size}px`;
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        loading="lazy"
        style={sx("flex:0 0 auto;object-fit:cover;border-radius:10px;border:1px solid var(--line)", { width: dim, height: dim })}
      />
    );
  }
  return <div style={sx("flex:0 0 auto;border-radius:10px;border:1px solid var(--line)", { width: dim, height: dim, background: GRADIENT })} />;
}

function PrimaryButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <Hoverable
      as="button"
      onClick={onClick}
      styles="display:inline-flex;align-items:center;gap:7px;background:var(--maroon);color:#fff;border:none;border-radius:10px;padding:9px 16px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap"
      hover="filter:brightness(1.08)"
    >
      {children}
    </Hoverable>
  );
}

function GhostButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <Hoverable
      as="button"
      onClick={onClick}
      styles="display:inline-flex;align-items:center;gap:7px;background:var(--paper);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:9px 15px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap"
      hover="border-color:#d9b7c2;box-shadow:0 4px 12px rgba(60,10,35,.08)"
    >
      {children}
    </Hoverable>
  );
}

function StatusBadge({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span style={sx("display:inline-block;font-size:12px;font-weight:800;padding:4px 11px;border-radius:20px;white-space:nowrap", { background: bg, color })}>
      {label}
    </span>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={css("font-family:'Reckless','Newsreader',serif;font-size:22px;font-weight:600;letter-spacing:-.3px;color:var(--ink);margin-bottom:16px")}>
      {children}
    </h2>
  );
}

export function BuyingDashboard({ onBrowse }: { onBrowse: () => void }) {
  const [data, setData] = useState<BuyingData | null>(null);
  const [loading, setLoading] = useState(true);
  // Local buyer decisions on countered offers (no buyer-side endpoint yet).
  const [overrides, setOverrides] = useState<Record<string, OfferStatus>>({});

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getBuyingData()
      .then((d) => {
        if (alive) setData(d ?? EMPTY);
      })
      .catch(() => {
        if (alive) setData(EMPTY);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const d = data ?? EMPTY;
  const offers = Array.isArray(d.offers) ? d.offers : [];
  const orders = (Array.isArray(d.orders) ? d.orders : []).slice(0, 12);
  const stats = d.stats ?? EMPTY.stats;

  const setStatus = (id: string, status: OfferStatus) => setOverrides((p) => ({ ...p, [id]: status }));

  return (
    <div style={css("max-width:960px")}>
      {/* Breadcrumb */}
      <div style={css("display:flex;align-items:center;gap:7px;font-size:12.5px;color:var(--muted);margin-bottom:22px")}>
        <span onClick={onBrowse} style={css("cursor:pointer")}>Browse</span>
        <span>/</span>
        <span style={css("color:var(--ink)")}>Buying</span>
      </div>

      {/* Header */}
      <h1 style={css("font-family:'Reckless','Newsreader',serif;font-size:clamp(28px,4.2vw,40px);font-weight:500;letter-spacing:-.5px;line-height:1.05;margin-bottom:8px")}>
        Your purchases
      </h1>
      <p style={css("color:var(--muted);font-size:14.5px;margin-bottom:26px")}>The offers you&apos;ve placed and the items on their way to you.</p>

      {/* Stat tiles */}
      <div data-buy-stats style={css("display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:34px")}>
        {([
          [stats.activeOffers, "Active offers"],
          [stats.accepted, "Accepted"],
          [stats.arriving, "On the way"],
        ] as const).map(([n, label]) => (
          <div key={label} style={css("background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:18px 20px")}>
            <div style={css("font-family:'Reckless','Newsreader',serif;font-size:34px;font-weight:500;letter-spacing:-.5px;line-height:1;color:var(--maroon)")}>
              {loading ? "—" : Math.max(0, Number(n) || 0)}
            </div>
            <div style={css("font-size:13px;color:var(--muted);margin-top:7px")}>{label}</div>
          </div>
        ))}
      </div>

      {/* Offers */}
      <SectionHeading>Offers you&apos;ve made</SectionHeading>
      {loading ? (
        <SkeletonRows />
      ) : offers.length > 0 ? (
        <div style={css("display:flex;flex-direction:column;gap:12px;margin-bottom:36px")}>
          {offers.map((o) => {
            const status = overrides[o.id] ?? o.status;
            const pill = statusPill(status);
            const listPrice = Number(o.listPriceCents) || 0;
            const canRespond = o.status === "countered" && !overrides[o.id];
            return (
              <div key={o.id} style={css("display:flex;align-items:center;gap:14px;background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:14px 16px;flex-wrap:wrap")}>
                <Thumb src={o.listingImage ?? null} />
                <div style={css("flex:1;min-width:180px")}>
                  <div style={css("font-size:15px;font-weight:700;line-height:1.3")}>{o.listingTitle || "Listing"}</div>
                  <div style={css("font-size:13px;color:var(--muted);margin-top:3px")}>
                    Your offer <b style={css("color:var(--ink)")}>{formatPrice(o.amountCents)}</b>
                    {listPrice > 0 && <> · list {formatPrice(listPrice)}</>}
                    {o.createdAt && <> · {timeAgo(o.createdAt)}</>}
                  </div>
                  {o.status === "countered" && o.counterCents != null && (
                    <div style={css("font-size:13px;color:var(--gold);font-weight:700;margin-top:4px")}>
                      Seller countered at {formatPrice(o.counterCents)}
                    </div>
                  )}
                  {canRespond && (
                    <div style={css("display:flex;gap:10px;margin-top:12px;flex-wrap:wrap")}>
                      <PrimaryButton onClick={() => setStatus(o.id, "accepted")}>Accept</PrimaryButton>
                      <GhostButton onClick={() => setStatus(o.id, "declined")}>Decline</GhostButton>
                    </div>
                  )}
                </div>
                <StatusBadge label={pill.label} bg={pill.bg} color={pill.color} />
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyRow title="No offers yet" text="Make an offer on a listing and it will show up here — accept or decline seller counters in one tap." onBrowse={onBrowse} />
      )}

      {/* Orders on the way */}
      <SectionHeading>Orders on the way</SectionHeading>
      {loading ? (
        <SkeletonRows />
      ) : orders.length > 0 ? (
        <div style={css("display:flex;flex-direction:column;gap:12px;margin-bottom:12px")}>
          {orders.map((o) => (
            <OrderRow key={o.id} o={o} />
          ))}
        </div>
      ) : (
        <EmptyRow title="Nothing arriving yet" text="Once a seller accepts your offer, your order and its live delivery status show up here." onBrowse={onBrowse} />
      )}

      {/* Responsive: stat tiles collapse to 2-up on narrow screens. */}
      <style>{"@media(max-width:720px){[data-buy-stats]{grid-template-columns:repeat(2,1fr)!important}}"}</style>
    </div>
  );
}

function OrderRow({ o }: { o: DashboardOrder }) {
  const pill = orderStatusLabel(o.status);
  const eta = orderEta(o);
  const { pct, color } = orderProgress(o.status);
  const balance = Number(o.balanceCents) || 0;
  return (
    <div style={css("background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:14px 16px")}>
      <div style={css("display:flex;align-items:center;gap:14px;flex-wrap:wrap")}>
        <Thumb src={o.listingImage ?? null} />
        <div style={css("flex:1;min-width:180px")}>
          <div style={css("display:flex;align-items:center;gap:10px;flex-wrap:wrap")}>
            <span style={css("font-size:15px;font-weight:700;line-height:1.3")}>{o.listingTitle || "Order"}</span>
            <StatusBadge label={pill.label} bg={pill.bg} color={pill.color} />
          </div>
          <div style={css("font-size:13px;color:var(--muted);margin-top:4px")}>
            <b style={css("color:var(--ink)")}>{formatPrice(o.priceCents)}</b>
            {balance > 0 && <> · {formatPrice(balance)} due on delivery</>}
          </div>
          {eta && <div style={css("font-size:12.5px;color:var(--muted);margin-top:3px")}>{eta}</div>}
        </div>
      </div>
      <div style={css("height:5px;border-radius:3px;margin-top:13px;overflow:hidden;background:var(--line)")}>
        <div style={sx("height:100%;border-radius:3px", { width: `${pct}%`, background: color })} />
      </div>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div style={css("display:flex;flex-direction:column;gap:12px;margin-bottom:36px")}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} style={css("display:flex;align-items:center;gap:14px;background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:14px 16px")}>
          <div style={sx("width:62px;height:62px;flex:0 0 auto;border-radius:10px;border:1px solid var(--line)", { background: GRADIENT, opacity: 0.55 })} />
          <div style={css("flex:1")}>
            <div style={css("height:12px;width:55%;border-radius:5px;background:var(--putty);margin-bottom:9px")} />
            <div style={css("height:11px;width:35%;border-radius:5px;background:var(--putty)")} />
          </div>
          <div style={css("height:24px;width:74px;border-radius:20px;background:var(--putty)")} />
        </div>
      ))}
    </div>
  );
}

function EmptyRow({ title, text, onBrowse }: { title: string; text: string; onBrowse: () => void }) {
  return (
    <div style={css("text-align:center;padding:44px 22px;background:var(--paper);border:1px solid var(--line);border-radius:14px;margin-bottom:36px")}>
      <div style={css("width:50px;height:50px;margin:0 auto 14px;border-radius:50%;background:var(--putty);display:flex;align-items:center;justify-content:center")}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M4 9h16l-1-4.5H5L4 9Z" /><path d="M5 9v10.5h14V9" /></svg>
      </div>
      <div style={css("font-family:'Reckless','Newsreader',serif;font-size:19px;color:var(--ink);margin-bottom:6px")}>{title}</div>
      <div style={css("font-size:14px;color:var(--muted);max-width:380px;margin:0 auto 16px")}>{text}</div>
      <PrimaryButton onClick={onBrowse}>Browse listings</PrimaryButton>
    </div>
  );
}
