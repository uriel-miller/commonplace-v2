"use client";

import { useCallback, useEffect, useState } from "react";
import { css, sx, Hoverable } from "@/lib/design/css";
import { formatPrice } from "@/lib/listing";
import { ChevronLeft, Pin } from "@/components/marketplace/icons";
// Type-only import — erased at compile time, so the server-only orders module
// (and its Prisma dependency) never reaches this client bundle.
import type { OrderRecord, OrderStatus } from "@/lib/orders";

export interface OrderTrackingProps {
  /** Fetch this order by id from /api/orders/[id]. */
  orderId?: string;
  /** Pre-loaded order (skips the fetch). */
  order?: OrderRecord | null;
  /** Back affordance. */
  onBack?: () => void;
  /** Browse affordance (empty/error states). */
  onBrowse?: () => void;
}

// Local copies of the lifecycle (client bundle must not import server runtime values).
const STEPS: { key: Exclude<OrderStatus, "cancelled">; label: string; blurb: string }[] = [
  { key: "reserved", label: "Reserved", blurb: "$1 deposit received" },
  { key: "scheduled", label: "Scheduled", blurb: "Delivery window set" },
  { key: "picked_up", label: "Picked up", blurb: "Collected from seller" },
  { key: "in_transit", label: "In transit", blurb: "On the way to you" },
  { key: "delivered", label: "Delivered", blurb: "Inspect it at home" },
  { key: "paid", label: "Paid", blurb: "Balance settled" },
];

function stepIndex(status: OrderStatus): number {
  if (status === "cancelled") return -1;
  return STEPS.findIndex((s) => s.key === status);
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatUsdCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/* --------------------------------- stepper --------------------------------- */
function Stepper({ status }: { status: OrderStatus }) {
  const current = stepIndex(status);
  return (
    <div style={css("display:flex;flex-direction:column;gap:0")}>
      {STEPS.map((step, i) => {
        const done = current >= 0 && i < current;
        const active = current >= 0 && i === current;
        const isLast = i === STEPS.length - 1;
        const dotBg = done || active ? "var(--maroon)" : "var(--paper)";
        const dotBorder = done || active ? "var(--maroon)" : "var(--line)";
        const dotColor = done || active ? "#fff" : "var(--muted)";
        return (
          <div key={step.key} style={css("display:flex;gap:14px")}>
            {/* rail */}
            <div style={css("display:flex;flex-direction:column;align-items:center")}>
              <div style={sx("width:26px;height:26px;flex:0 0 auto;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800", { background: dotBg, border: `2px solid ${dotBorder}`, color: dotColor })}>
                {done ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                ) : (
                  i + 1
                )}
              </div>
              {!isLast && <div style={sx("width:2px;flex:1;min-height:26px", { background: done ? "var(--maroon)" : "var(--line)" })} />}
            </div>
            {/* label */}
            <div style={sx("padding-bottom:18px", isLast ? "padding-bottom:0" : "")}>
              <div style={sx("font-size:14px;font-weight:800;line-height:1.2", active ? "color:var(--maroon)" : done ? "color:var(--ink)" : "color:var(--muted)")}>{step.label}</div>
              <div style={css("font-size:12px;color:var(--muted);margin-top:2px")}>{step.blurb}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------- main view --------------------------------- */
export function OrderTracking({ orderId, order: initial, onBack, onBrowse }: OrderTrackingProps) {
  const [order, setOrder] = useState<OrderRecord | null>(initial ?? null);
  const [loading, setLoading] = useState<boolean>(!initial && !!orderId);
  const [error, setError] = useState<string | null>(null);

  const id = order?.id ?? orderId;

  const load = useCallback(async (targetId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(targetId)}`);
      const data = (await res.json()) as { order?: OrderRecord | null; error?: string };
      if (!res.ok || !data.order) {
        setError(data.error || "We couldn’t find that order.");
        setOrder(null);
        return;
      }
      setOrder(data.order);
    } catch {
      setError("Network hiccup — please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initial) {
      setOrder(initial);
      return;
    }
    if (orderId) void load(orderId);
  }, [initial, orderId, load]);

  const Breadcrumb = (
    <div style={css("display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:14px")}>
      {onBack && (
        <Hoverable as="a" onClick={onBack} styles="color:var(--blueInk);font-weight:600;cursor:pointer;display:flex;align-items:center;gap:4px" hover="color:var(--maroon)">
          <ChevronLeft stroke="currentColor" />Back
        </Hoverable>
      )}
      <span style={css("color:var(--muted)")}>/ Order tracking</span>
    </div>
  );

  if (loading) {
    return (
      <div style={css("max-width:900px")}>
        {Breadcrumb}
        <div style={css("padding:60px 20px;text-align:center;color:var(--muted);font-size:14px")}>Loading your order…</div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div style={css("max-width:900px")}>
        {Breadcrumb}
        <div style={css("max-width:520px;margin:30px auto;text-align:center;padding:20px")}>
          <h2 style={css("font-family:'Newsreader',serif;font-size:24px;font-weight:500;letter-spacing:-.4px;margin-bottom:6px")}>Order not found</h2>
          <p style={css("color:var(--muted);font-size:14px;line-height:1.55;margin-bottom:18px")}>{error || "We couldn’t find that order."}</p>
          <div style={css("display:flex;gap:10px;justify-content:center;flex-wrap:wrap")}>
            {id && (
              <Hoverable as="button" type="button" onClick={() => load(id)} styles="background:var(--paper);color:var(--ink);border:1px solid var(--line);border-radius:12px;padding:12px 20px;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit" hover="background:var(--putty)">Retry</Hoverable>
            )}
            {onBrowse && (
              <Hoverable as="button" type="button" onClick={onBrowse} styles="background:var(--maroon);color:#fff;border:none;border-radius:12px;padding:12px 20px;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit" hover="filter:brightness(1.08)">Browse listings</Hoverable>
            )}
          </div>
        </div>
      </div>
    );
  }

  const cancelled = order.status === "cancelled";
  const img = order.listingImage;

  return (
    <div style={css("max-width:900px")}>
      {Breadcrumb}

      {/* Header */}
      <div style={css("display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;margin-bottom:18px")}>
        <div style={css("width:88px;height:88px;flex:0 0 auto;border-radius:12px;overflow:hidden;position:relative;background:repeating-linear-gradient(135deg,#EDE4D6 0 12px,#E5DACA 12px 24px)")}>
          {img && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt={order.listingTitle} loading="lazy" style={css("position:absolute;inset:0;width:100%;height:100%;object-fit:cover")} />
          )}
        </div>
        <div style={css("flex:1;min-width:220px")}>
          <div style={css("font-size:12px;color:var(--muted);margin-bottom:3px")}>
            Order <span style={css("font-family:ui-monospace,'SF Mono',Menlo,monospace;color:var(--ink);font-weight:700")}>{order.id.slice(0, 8).toUpperCase()}</span> · {formatWhen(order.createdAt)}
          </div>
          <h1 style={css("font-family:'Newsreader',serif;font-size:26px;font-weight:500;letter-spacing:-.4px;line-height:1.15")}>{order.listingTitle}</h1>
          {order.deliverCity && (
            <div style={css("display:flex;align-items:center;gap:5px;font-size:12.5px;color:var(--muted);margin-top:5px")}>
              <Pin size={13} />Delivering to {order.deliverCity}
            </div>
          )}
        </div>
      </div>

      {cancelled && (
        <div style={css("background:#fdecec;border:1px solid #f3b7b7;border-radius:12px;padding:14px 16px;font-size:13.5px;color:#a11;margin-bottom:18px;line-height:1.5")}>
          <b>This order was cancelled.</b> No balance is due. Reach out to support if this was a mistake.
        </div>
      )}

      <div style={css("display:grid;grid-template-columns:1.3fr 1fr;gap:22px;align-items:start")}>
        {/* Stepper */}
        <div style={css("background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:20px")}>
          <div style={css("font-size:15px;font-weight:800;margin-bottom:16px")}>Delivery progress</div>
          {cancelled ? (
            <div style={css("font-size:13.5px;color:var(--muted);line-height:1.5")}>Progress stopped — this order was cancelled.</div>
          ) : (
            <Stepper status={order.status} />
          )}
        </div>

        {/* Payment + timeline */}
        <div style={css("display:flex;flex-direction:column;gap:12px")}>
          <div style={css("background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:18px")}>
            <div style={css("font-size:15px;font-weight:800;margin-bottom:13px")}>Payment</div>
            <div style={css("display:flex;flex-direction:column;gap:10px")}>
              <div style={css("display:flex;align-items:center;justify-content:space-between;gap:12px")}>
                <span style={css("font-size:13.5px;color:var(--muted)")}>Subtotal</span>
                <span style={css("font-size:14px;font-weight:700")}>{formatPrice(order.priceCents)}</span>
              </div>
              <div style={css("display:flex;align-items:center;justify-content:space-between;gap:12px")}>
                <span style={css("font-size:13.5px;color:var(--muted)")}>Delivery</span>
                <span style={css("font-size:14px;font-weight:700")}>{order.deliveryFeeCents > 0 ? formatPrice(order.deliveryFeeCents) : "FREE"}</span>
              </div>
              <div style={css("height:1px;background:var(--line);margin:3px 0")} />
              <div style={css("display:flex;align-items:center;justify-content:space-between;gap:12px")}>
                <span style={css("font-size:13.5px;font-weight:800")}>Paid today</span>
                <span style={css("font-size:15px;font-weight:800")}>{formatUsdCents(order.depositCents)}</span>
              </div>
              <div style={css("display:flex;align-items:center;justify-content:space-between;gap:12px")}>
                <span style={css("font-size:13.5px;color:var(--muted)")}>{order.status === "paid" ? "Balance" : order.manualWire ? "Balance by wire" : "Due on delivery"}</span>
                <span style={sx("font-size:14px;font-weight:700", order.status === "paid" ? "color:var(--green,#1f7a4d)" : "")}>{order.status === "paid" ? "Paid" : formatPrice(order.balanceCents)}</span>
              </div>
            </div>
            <div style={css("margin-top:12px;font-size:11.5px;color:var(--muted);line-height:1.45")}>{order.deliveryMessage}</div>
          </div>

          {order.events.length > 0 && (
            <div style={css("background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:18px")}>
              <div style={css("font-size:15px;font-weight:800;margin-bottom:13px")}>Timeline</div>
              <div style={css("display:flex;flex-direction:column;gap:11px")}>
                {order.events
                  .slice()
                  .reverse()
                  .map((ev) => (
                    <div key={ev.id} style={css("display:flex;gap:10px;align-items:flex-start")}>
                      <span style={css("width:7px;height:7px;flex:0 0 auto;border-radius:50%;background:var(--maroon);margin-top:5px")} />
                      <div style={css("min-width:0")}>
                        <div style={css("font-size:13px;font-weight:600;line-height:1.3")}>{ev.label}</div>
                        <div style={css("font-size:11px;color:var(--muted);margin-top:1px")}>{formatWhen(ev.at)}</div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
