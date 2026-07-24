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
const CARD_SHADOW = "0 4px 16px rgba(60,10,35,.05)";
const CARD_HOVER = "box-shadow:0 8px 24px rgba(60,10,35,.1);transform:translateY(-1px)";

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
function orderProgress(status: string): { pct: number; color: string; step: string } {
  switch (status) {
    case "cancelled":
      return { pct: 100, color: "var(--red)", step: "Cancelled" };
    case "paid":
    case "delivered":
      return { pct: 100, color: "var(--maroon)", step: "Delivered" };
    case "in_transit":
      return { pct: 80, color: "var(--blue)", step: "In transit" };
    case "picked_up":
      return { pct: 55, color: "var(--blue)", step: "Picked up" };
    case "scheduled":
      return { pct: 30, color: "var(--blue)", step: "Scheduled" };
    default:
      return { pct: 12, color: "var(--blue)", step: "Reserved" };
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

function Thumb({ src, size = 64 }: { src: string | null; size?: number }) {
  const dim = `${size}px`;
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        loading="lazy"
        style={sx("flex:0 0 auto;object-fit:cover;border-radius:12px;border:1px solid var(--line)", { width: dim, height: dim })}
      />
    );
  }
  return <div style={sx("flex:0 0 auto;border-radius:12px;border:1px solid var(--line)", { width: dim, height: dim, background: GRADIENT })} />;
}

function PrimaryButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <Hoverable
      as="button"
      onClick={onClick}
      styles="display:inline-flex;align-items:center;gap:7px;background:var(--maroon);color:#fff;border:none;border-radius:11px;padding:10px 17px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;box-shadow:0 2px 8px rgba(98,14,59,.22)"
      hover="filter:brightness(1.08);box-shadow:0 6px 16px rgba(98,14,59,.3)"
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
      styles="display:inline-flex;align-items:center;gap:7px;background:var(--paper);color:var(--ink);border:1px solid var(--line);border-radius:11px;padding:10px 16px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap"
      hover="border-color:#d9b7c2;box-shadow:0 4px 12px rgba(60,10,35,.08)"
    >
      {children}
    </Hoverable>
  );
}

function StatusBadge({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span style={sx("display:inline-block;font-size:12px;font-weight:800;padding:4px 11px;border-radius:20px;white-space:nowrap;letter-spacing:.1px", { background: bg, color })}>
      {label}
    </span>
  );
}

function CountChip({ n }: { n: number }) {
  return (
    <span style={css("display:inline-flex;align-items:center;justify-content:center;min-width:24px;height:24px;padding:0 8px;border-radius:20px;background:var(--tint);color:var(--maroon);font-size:12.5px;font-weight:800;font-family:inherit")}>
      {n}
    </span>
  );
}

function SectionHeading({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div style={css("display:flex;align-items:center;gap:11px;margin-bottom:18px")}>
      <h2 style={css("font-family:'Reckless','Newsreader',serif;font-size:23px;font-weight:600;letter-spacing:-.3px;color:var(--ink)")}>
        {children}
      </h2>
      {typeof count === "number" && count > 0 && <CountChip n={count} />}
    </div>
  );
}

/* ---- stat tile icons (inline SVG, currentColor) ---- */
function IconTag() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.6 13.4 13 21a1.7 1.7 0 0 1-2.4 0L3.5 13.9A2 2 0 0 1 3 12.5V5a2 2 0 0 1 2-2h7.5a2 2 0 0 1 1.4.6l6.7 6.7a1.7 1.7 0 0 1 0 2.1Z" />
      <circle cx="7.5" cy="7.5" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.4 2.4 4.6-4.8" />
    </svg>
  );
}
function IconTruck() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h11v9H3zM14 9h4l3 3v3h-7z" />
      <circle cx="7" cy="18" r="1.6" />
      <circle cx="17.5" cy="18" r="1.6" />
    </svg>
  );
}

interface TileSpec {
  n: number;
  label: string;
  bg: string;
  ink: string;
  badgeBg: string;
  icon: React.ReactNode;
}

function StatTile({ tile, loading }: { tile: TileSpec; loading: boolean }) {
  return (
    <div style={sx("border-radius:16px;padding:20px 22px", { background: tile.bg, boxShadow: CARD_SHADOW })}>
      <div style={sx("width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-bottom:16px", { background: tile.badgeBg, color: tile.ink })}>
        {tile.icon}
      </div>
      <div style={sx("font-family:'Reckless','Newsreader',serif;font-size:38px;font-weight:500;letter-spacing:-.5px;line-height:1", { color: tile.ink })}>
        {loading ? "—" : Math.max(0, Number(tile.n) || 0)}
      </div>
      <div style={css("font-size:13px;color:var(--muted);margin-top:8px;font-weight:500")}>{tile.label}</div>
    </div>
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

  const tiles: TileSpec[] = [
    { n: stats.activeOffers, label: "Active offers", bg: "var(--blueBg)", ink: "var(--blueInk)", badgeBg: "rgba(255,255,255,.7)", icon: <IconTag /> },
    { n: stats.accepted, label: "Accepted", bg: "var(--greenBg)", ink: "var(--green)", badgeBg: "rgba(255,255,255,.7)", icon: <IconCheck /> },
    { n: stats.arriving, label: "On the way", bg: "var(--yellowBg)", ink: "var(--gold)", badgeBg: "rgba(255,255,255,.7)", icon: <IconTruck /> },
  ];

  return (
    <div style={css("max-width:1040px")}>
      {/* Breadcrumb */}
      <div style={css("display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--muted);margin-bottom:20px")}>
        <Hoverable as="span" onClick={onBrowse} styles="cursor:pointer" hover="color:var(--maroon)">Browse</Hoverable>
        <span style={css("opacity:.5")}>/</span>
        <span style={css("color:var(--ink);font-weight:600")}>Buying</span>
      </div>

      {/* Header */}
      <h1 style={css("font-family:'Reckless','Newsreader',serif;font-size:clamp(30px,4.4vw,42px);font-weight:500;letter-spacing:-.5px;line-height:1.04;margin-bottom:10px")}>
        Your purchases
      </h1>
      <p style={css("color:var(--muted);font-size:15px;line-height:1.5;margin-bottom:28px;max-width:560px")}>The offers you&apos;ve placed and the items on their way to you, all in one place.</p>

      {/* Stat tiles */}
      <div data-buy-stats style={css("display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:38px")}>
        {tiles.map((tile) => (
          <StatTile key={tile.label} tile={tile} loading={loading} />
        ))}
      </div>

      {/* Offers */}
      <SectionHeading count={loading ? undefined : offers.length}>Offers you&apos;ve made</SectionHeading>
      {loading ? (
        <SkeletonRows />
      ) : offers.length > 0 ? (
        <div style={css("display:flex;flex-direction:column;gap:14px;margin-bottom:38px")}>
          {offers.map((o) => {
            const status = overrides[o.id] ?? o.status;
            const pill = statusPill(status);
            const listPrice = Number(o.listPriceCents) || 0;
            const canRespond = o.status === "countered" && !overrides[o.id];
            return (
              <Hoverable
                key={o.id}
                styles={sx("display:flex;align-items:center;gap:16px;background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:16px 18px;flex-wrap:wrap;transition:box-shadow .15s,transform .15s", { boxShadow: CARD_SHADOW })}
                hover={CARD_HOVER}
              >
                <Thumb src={o.listingImage ?? null} />
                <div style={css("flex:1;min-width:190px")}>
                  <div style={css("font-size:15.5px;font-weight:700;line-height:1.3")}>{o.listingTitle || "Listing"}</div>
                  <div style={css("font-size:13px;color:var(--muted);margin-top:4px")}>
                    Your offer <b style={css("color:var(--ink)")}>{formatPrice(o.amountCents)}</b>
                    {listPrice > 0 && <> · list {formatPrice(listPrice)}</>}
                    {o.createdAt && <> · {timeAgo(o.createdAt)}</>}
                  </div>
                  {o.status === "countered" && o.counterCents != null && (
                    <div style={css("font-size:13px;color:var(--gold);font-weight:700;margin-top:5px")}>
                      Seller countered at {formatPrice(o.counterCents)}
                    </div>
                  )}
                  {canRespond && (
                    <div style={css("display:flex;gap:10px;margin-top:13px;flex-wrap:wrap")}>
                      <PrimaryButton onClick={() => setStatus(o.id, "accepted")}>Accept</PrimaryButton>
                      <GhostButton onClick={() => setStatus(o.id, "declined")}>Decline</GhostButton>
                    </div>
                  )}
                </div>
                <StatusBadge label={pill.label} bg={pill.bg} color={pill.color} />
              </Hoverable>
            );
          })}
        </div>
      ) : (
        <EmptyRow title="No offers yet" text="Make an offer on a listing and it will show up here — accept or decline seller counters in one tap." onBrowse={onBrowse} />
      )}

      {/* Orders on the way */}
      <SectionHeading count={loading ? undefined : orders.length}>Orders on the way</SectionHeading>
      {loading ? (
        <SkeletonRows />
      ) : orders.length > 0 ? (
        <div style={css("display:flex;flex-direction:column;gap:14px;margin-bottom:12px")}>
          {orders.map((o) => (
            <OrderRow key={o.id} o={o} />
          ))}
        </div>
      ) : (
        <EmptyRow title="Nothing arriving yet" text="Once a seller accepts your offer, your order and its live delivery status show up here." onBrowse={onBrowse} />
      )}

      {/* Responsive: stat tiles collapse to a single column on narrow screens. */}
      <style>{"@media(max-width:640px){[data-buy-stats]{grid-template-columns:1fr!important}}"}</style>
    </div>
  );
}

function OrderRow({ o }: { o: DashboardOrder }) {
  const pill = orderStatusLabel(o.status);
  const eta = orderEta(o);
  const { pct, color, step } = orderProgress(o.status);
  const balance = Number(o.balanceCents) || 0;
  return (
    <Hoverable
      styles={sx("background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:16px 18px;transition:box-shadow .15s,transform .15s", { boxShadow: CARD_SHADOW })}
      hover={CARD_HOVER}
    >
      <div style={css("display:flex;align-items:center;gap:16px;flex-wrap:wrap")}>
        <Thumb src={o.listingImage ?? null} />
        <div style={css("flex:1;min-width:190px")}>
          <div style={css("display:flex;align-items:center;gap:10px;flex-wrap:wrap")}>
            <span style={css("font-size:15.5px;font-weight:700;line-height:1.3")}>{o.listingTitle || "Order"}</span>
            <StatusBadge label={pill.label} bg={pill.bg} color={pill.color} />
          </div>
          <div style={css("font-size:13px;color:var(--muted);margin-top:5px")}>
            <b style={css("color:var(--ink)")}>{formatPrice(o.priceCents)}</b>
            {balance > 0 && <> · {formatPrice(balance)} due on delivery</>}
          </div>
          {eta && <div style={css("font-size:12.5px;color:var(--muted);margin-top:3px")}>{eta}</div>}
        </div>
      </div>
      <div style={css("display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:15px")}>
        <div style={css("flex:1;height:6px;border-radius:6px;overflow:hidden;background:var(--line)")}>
          <div style={sx("height:100%;border-radius:6px;transition:width .3s", { width: `${pct}%`, background: color })} />
        </div>
        <span style={sx("font-size:11.5px;font-weight:700;white-space:nowrap", { color })}>{step}</span>
      </div>
    </Hoverable>
  );
}

function SkeletonRows() {
  return (
    <div style={css("display:flex;flex-direction:column;gap:14px;margin-bottom:38px")}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} style={sx("display:flex;align-items:center;gap:16px;background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:16px 18px", { boxShadow: CARD_SHADOW })}>
          <div style={sx("width:64px;height:64px;flex:0 0 auto;border-radius:12px;border:1px solid var(--line)", { background: GRADIENT, opacity: 0.55 })} />
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
    <div style={sx("text-align:center;padding:52px 24px;background:var(--paper);border:1px solid var(--line);border-radius:16px;margin-bottom:38px", { boxShadow: CARD_SHADOW })}>
      <div style={css("width:56px;height:56px;margin:0 auto 16px;border-radius:50%;background:var(--tint);display:flex;align-items:center;justify-content:center")}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--maroon)" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M4 9h16l-1-4.5H5L4 9Z" /><path d="M5 9v10.5h14V9" /><path d="M9.5 13h5" /></svg>
      </div>
      <div style={css("font-family:'Reckless','Newsreader',serif;font-size:20px;color:var(--ink);margin-bottom:7px")}>{title}</div>
      <div style={css("font-size:14px;color:var(--muted);line-height:1.5;max-width:400px;margin:0 auto 18px")}>{text}</div>
      <PrimaryButton onClick={onBrowse}>Browse listings</PrimaryButton>
    </div>
  );
}
