"use client";

// Buyer dashboard — offers the buyer placed + orders on the way, in the exact
// marketplace look (stat-tile + list-row styling ported from MarketplaceApp's
// Buying/Selling views). Data comes from the getBuyingData() server function;
// every failure degrades to a real empty state rather than a blank or a throw.

import { useEffect, useState } from "react";
import { css, sx } from "@/lib/design/css";
import { ChevronLeft, Pin } from "@/components/marketplace/icons";
import { formatPrice } from "@/lib/listing";
import { getBuyingData } from "@/lib/dashboards";
import type { BuyingData, DashboardOrder, OfferDTO } from "@/lib/dashboards";

const EMPTY: BuyingData = {
  offers: [],
  orders: [],
  stats: { activeOffers: 0, accepted: 0, arriving: 0 },
};

const GRADIENT = "repeating-linear-gradient(135deg,#EDE4D6 0 10px,#E5DACA 10px 20px)";

/* Status → pill palette, matching the marketplace status chips. */
function statusPill(status: OfferDTO["status"]): { bg: string; color: string; label: string } {
  switch (status) {
    case "accepted":
      return { bg: "var(--greenBg)", color: "var(--green)", label: "Accepted" };
    case "countered":
      return { bg: "var(--yellowBg)", color: "var(--gold)", label: "Countered" };
    case "declined":
      return { bg: "#F1E7E4", color: "var(--red)", label: "Declined" };
    default:
      return { bg: "var(--blueBg)", color: "var(--blueInk)", label: "Pending" };
  }
}

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
      return { bg: "#F1E7E4", color: "var(--red)", label: "Cancelled" };
    default:
      return { bg: "var(--blueBg)", color: "var(--blueInk)", label: "Reserved" };
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

function Thumb({ src }: { src: string | null }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        loading="lazy"
        style={css("width:60px;height:60px;flex:0 0 auto;border-radius:9px;object-fit:cover")}
      />
    );
  }
  return <div style={sx("width:60px;height:60px;flex:0 0 auto;border-radius:9px", { background: GRADIENT })} />;
}

export function BuyingDashboard({ onBrowse }: { onBrowse: () => void }) {
  const [data, setData] = useState<BuyingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getBuyingData()
      .then((d) => {
        if (alive) setData(d);
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
  const arriving = d.orders.filter((o) =>
    ["scheduled", "picked_up", "in_transit", "reserved"].includes(o.status),
  );

  return (
    <div style={css("max-width:960px")}>
      <div style={css("display:flex;align-items:center;gap:10px;margin-bottom:4px")}>
        <a onClick={onBrowse} style={css("color:var(--blueInk);font-size:14px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:4px")}>
          <ChevronLeft stroke="currentColor" />Browse
        </a>
        <span style={css("color:var(--muted);font-size:14px")}>/ Buying</span>
      </div>
      <h2 style={css("font-family:'Newsreader',serif;font-size:30px;font-weight:500;letter-spacing:-.4px;margin-bottom:2px")}>Your buying activity</h2>
      <p style={css("color:var(--muted);font-size:14px;margin-bottom:22px")}>Offers you&apos;ve placed and items on the way.</p>

      {/* Stat tiles */}
      <div style={css("display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:26px")}>
        {([
          [d.stats.activeOffers, "Active offers", "var(--ink)"],
          [d.stats.accepted, "Accepted", "var(--green)"],
          [d.stats.arriving, "Arriving soon", "var(--ink)"],
        ] as const).map(([n, l, c]) => (
          <div key={l} style={css("background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px")}>
            <div style={sx("font-size:28px;font-weight:800;letter-spacing:-.5px", { color: c })}>{loading ? "…" : n}</div>
            <div style={css("font-size:13px;color:var(--muted)")}>{l}</div>
          </div>
        ))}
      </div>

      {/* Offers */}
      <h3 style={css("font-size:19px;font-weight:800;margin-bottom:12px")}>Your offers</h3>
      {loading ? (
        <SkeletonRows />
      ) : d.offers.length > 0 ? (
        <div style={css("display:flex;flex-direction:column;gap:11px;margin-bottom:30px")}>
          {d.offers.map((o) => {
            const pill = statusPill(o.status);
            return (
              <div key={o.id} style={css("display:flex;align-items:center;gap:14px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 14px")}>
                <Thumb src={o.listingImage} />
                <div style={css("flex:1;min-width:0")}>
                  <div style={css("font-size:14.5px;font-weight:600;line-height:1.3")}>{o.listingTitle}</div>
                  <div style={css("font-size:12.5px;color:var(--muted);margin-top:2px")}>
                    Your offer <b style={css("color:var(--ink)")}>{formatPrice(o.amountCents)}</b>
                    {o.listPriceCents > 0 && <> · list {formatPrice(o.listPriceCents)}</>}
                    {o.createdAt && <> · {timeAgo(o.createdAt)}</>}
                  </div>
                  {o.status === "countered" && o.counterCents != null && (
                    <div style={css("font-size:12.5px;color:var(--gold);font-weight:700;margin-top:3px")}>
                      Seller countered at {formatPrice(o.counterCents)}
                    </div>
                  )}
                </div>
                <div style={css("display:flex;flex-direction:column;align-items:flex-end;gap:6px")}>
                  <span style={sx("font-size:12px;font-weight:700;padding:5px 12px;border-radius:20px", { background: pill.bg, color: pill.color })}>{pill.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyRow title="No offers yet" text="Make an offer on a listing and it'll show up here." onBrowse={onBrowse} />
      )}

      {/* Orders on the way */}
      <h3 style={css("font-size:19px;font-weight:800;margin-bottom:12px")}>On the way</h3>
      {loading ? (
        <SkeletonRows />
      ) : arriving.length > 0 ? (
        <div style={css("display:flex;flex-direction:column;gap:11px;margin-bottom:30px")}>
          {arriving.map((o) => (
            <OrderRow key={o.id} o={o} />
          ))}
        </div>
      ) : (
        <EmptyRow title="Nothing arriving yet" text="Accepted orders and deliveries in progress will appear here." onBrowse={onBrowse} />
      )}
    </div>
  );
}

function OrderRow({ o }: { o: DashboardOrder }) {
  const pill = orderStatusLabel(o.status);
  return (
    <div style={css("display:flex;align-items:center;gap:14px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 14px")}>
      <Thumb src={o.listingImage} />
      <div style={css("flex:1;min-width:0")}>
        <div style={css("font-size:14.5px;font-weight:600;line-height:1.3")}>{o.listingTitle}</div>
        <div style={css("display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--muted);margin-top:3px;flex-wrap:wrap")}>
          <span><b style={css("color:var(--ink)")}>{formatPrice(o.priceCents)}</b></span>
          {o.balanceCents > 0 && <span>· {formatPrice(o.balanceCents)} due on delivery</span>}
          {o.deliverCity && (
            <span style={css("display:inline-flex;align-items:center;gap:3px")}>· <Pin size={12} />{o.deliverCity}</span>
          )}
        </div>
      </div>
      <span style={sx("font-size:12px;font-weight:700;padding:5px 12px;border-radius:20px", { background: pill.bg, color: pill.color })}>{pill.label}</span>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div style={css("display:flex;flex-direction:column;gap:11px;margin-bottom:30px")}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} style={css("display:flex;align-items:center;gap:14px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 14px")}>
          <div style={sx("width:60px;height:60px;flex:0 0 auto;border-radius:9px", { background: GRADIENT, opacity: 0.55 })} />
          <div style={css("flex:1")}>
            <div style={css("height:12px;width:55%;border-radius:5px;background:var(--putty);margin-bottom:8px")} />
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
    <div style={css("text-align:center;padding:34px 20px;background:#fff;border:1px dashed var(--line);border-radius:12px;margin-bottom:30px")}>
      <div style={css("font-family:'Newsreader',serif;font-size:18px;color:var(--ink);margin-bottom:4px")}>{title}</div>
      <div style={css("font-size:13.5px;color:var(--muted);margin-bottom:14px")}>{text}</div>
      <button onClick={onBrowse} style={css("border:1px solid var(--blueInk);background:#fff;color:var(--blueInk);border-radius:9px;padding:9px 16px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit")}>Browse listings</button>
    </div>
  );
}
