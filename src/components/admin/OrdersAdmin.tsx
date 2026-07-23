"use client";

// OrdersAdmin — dense admin table of every order with a per-row status-advance
// control. Self-fetches from GET /api/admin/orders (fail-soft to empty) and
// advances lifecycle via PATCH /api/admin/orders/[id]. Money shown via
// @/lib/fees + formatPrice; all amounts are integer cents.

import { useCallback, useEffect, useMemo, useState } from "react";
import { css, sx, Hoverable } from "@/lib/design/css";
import { formatPrice } from "@/lib/listing";

/* ------------------------------- lifecycle -------------------------------- */

type OrderStatus =
  | "reserved"
  | "scheduled"
  | "picked_up"
  | "in_transit"
  | "delivered"
  | "paid"
  | "cancelled";

const NEXT: Record<OrderStatus, OrderStatus | null> = {
  reserved: "scheduled",
  scheduled: "picked_up",
  picked_up: "in_transit",
  in_transit: "delivered",
  delivered: "paid",
  paid: null,
  cancelled: null,
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  reserved: "Reserved",
  scheduled: "Scheduled",
  picked_up: "Picked up",
  in_transit: "In transit",
  delivered: "Delivered",
  paid: "Paid",
  cancelled: "Cancelled",
};

const STATUS_STYLE: Record<OrderStatus, string> = {
  reserved: "background:var(--yellowBg);color:var(--gold)",
  scheduled: "background:var(--blueBg);color:var(--blueInk)",
  picked_up: "background:var(--blueBg);color:var(--blueInk)",
  in_transit: "background:var(--blueBg);color:var(--blueInk)",
  delivered: "background:var(--greenBg);color:var(--green)",
  paid: "background:var(--greenBg);color:var(--green)",
  cancelled: "background:var(--tint);color:var(--muted)",
};

function isOrderStatus(s: string): s is OrderStatus {
  return s in NEXT;
}

/** Statuses an admin may move an order TO from `from`. */
function allowedTargets(from: OrderStatus): OrderStatus[] {
  if (from === "paid" || from === "cancelled") return [];
  const out: OrderStatus[] = [];
  const nxt = NEXT[from];
  if (nxt) out.push(nxt);
  out.push("cancelled");
  return out;
}

/* --------------------------------- types ---------------------------------- */

interface OrderEventRow {
  id: string;
  label: string;
  at: string;
}

export interface AdminOrderRow {
  id: string;
  listingId: number;
  listingTitle: string;
  listingImage: string | null;
  buyerName: string;
  priceCents: number;
  depositCents: number;
  balanceCents: number;
  deliveryFeeCents: number;
  status: string;
  pickupCity: string | null;
  deliverCity: string | null;
  createdAt: string;
  updatedAt: string;
  events: OrderEventRow[];
}

/* -------------------------------- helpers --------------------------------- */

function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      style={sx(
        "display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:0.03em;text-transform:uppercase;white-space:nowrap",
        STATUS_STYLE[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

const TH =
  "text-align:left;padding:10px 12px;font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:var(--muted);border-bottom:1px solid var(--line);white-space:nowrap";
const TD =
  "padding:12px;font-size:13.5px;color:var(--ink);border-bottom:1px solid var(--line);vertical-align:top";

/* ------------------------------- component -------------------------------- */

export default function OrdersAdmin() {
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/orders", { cache: "no-store" });
      const data = (await res.json()) as { ok?: boolean; orders?: AdminOrderRow[] };
      if (!res.ok || !data.ok) {
        setError(res.status === 401 ? "Not authorized." : "Could not load orders.");
        setOrders([]);
      } else {
        setOrders(Array.isArray(data.orders) ? data.orders : []);
      }
    } catch {
      setError("Network error loading orders.");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const advance = useCallback(
    async (id: string, next: OrderStatus) => {
      setBusyId(id);
      try {
        const res = await fetch(`/api/admin/orders/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: next }),
        });
        const data = (await res.json()) as { ok?: boolean; status?: string };
        if (res.ok && data.ok && data.status) {
          const applied = data.status;
          setOrders((prev) =>
            prev.map((o) =>
              o.id === id
                ? {
                    ...o,
                    status: applied,
                    events: [
                      ...o.events,
                      {
                        id: `local-${Date.now()}`,
                        label: STATUS_LABEL[applied as OrderStatus] ?? applied,
                        at: new Date().toISOString(),
                      },
                    ],
                  }
                : o,
            ),
          );
        } else {
          // Re-sync from server on any conflict/failure.
          void load();
        }
      } catch {
        void load();
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const totals = useMemo(() => {
    let gross = 0;
    let live = 0;
    for (const o of orders) {
      gross += o.priceCents;
      if (o.status !== "paid" && o.status !== "cancelled") live += 1;
    }
    return { gross, live, count: orders.length };
  }, [orders]);

  return (
    <div style={css("font-family:var(--font-sans, system-ui, sans-serif)")}>
      <header
        style={css(
          "display:flex;align-items:baseline;justify-content:space-between;gap:16px;margin-bottom:14px;flex-wrap:wrap",
        )}
      >
        <div>
          <h2
            style={css(
              "font-family:'Newsreader',serif;font-size:22px;font-weight:600;color:var(--ink);margin:0",
            )}
          >
            Orders
          </h2>
          <p style={css("margin:2px 0 0;font-size:13px;color:var(--muted)")}>
            {totals.count} order{totals.count === 1 ? "" : "s"} · {totals.live} live ·{" "}
            {formatPrice(totals.gross)} gross
          </p>
        </div>
        <Hoverable
          as="button"
          onClick={() => void load()}
          styles="border:1px solid var(--line);background:var(--paper);color:var(--ink);padding:7px 14px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer"
          hover="background:var(--tint)"
        >
          Refresh
        </Hoverable>
      </header>

      {error ? (
        <div
          style={css(
            "padding:14px;border:1px solid var(--line);border-radius:10px;background:var(--tint);color:var(--maroon);font-size:13.5px",
          )}
        >
          {error}
        </div>
      ) : loading ? (
        <div style={css("padding:24px;color:var(--muted);font-size:14px")}>Loading orders…</div>
      ) : orders.length === 0 ? (
        <div
          style={css(
            "padding:32px;text-align:center;color:var(--muted);font-size:14px;border:1px dashed var(--line);border-radius:12px",
          )}
        >
          No orders yet.
        </div>
      ) : (
        <div
          style={css(
            "overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:var(--paper)",
          )}
        >
          <table style={css("width:100%;border-collapse:collapse;min-width:860px")}>
            <thead>
              <tr>
                <th style={css(TH)}>Buyer</th>
                <th style={css(TH)}>Item</th>
                <th style={css(TH)}>Price</th>
                <th style={css(TH)}>Deposit</th>
                <th style={css(TH)}>Balance</th>
                <th style={css(TH)}>Delivery</th>
                <th style={css(TH)}>Status</th>
                <th style={css(TH)}>Advance</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const status: OrderStatus = isOrderStatus(o.status) ? o.status : "reserved";
                const targets = allowedTargets(status);
                const busy = busyId === o.id;
                const isOpen = expanded === o.id;
                return (
                  <FragmentRow
                    key={o.id}
                    order={o}
                    status={status}
                    targets={targets}
                    busy={busy}
                    isOpen={isOpen}
                    onToggle={() => setExpanded(isOpen ? null : o.id)}
                    onAdvance={(next) => void advance(o.id, next)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ------------------------------- table row -------------------------------- */

function FragmentRow({
  order,
  status,
  targets,
  busy,
  isOpen,
  onToggle,
  onAdvance,
}: {
  order: AdminOrderRow;
  status: OrderStatus;
  targets: OrderStatus[];
  busy: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onAdvance: (next: OrderStatus) => void;
}) {
  return (
    <>
      <tr>
        <td style={css(TD)}>
          <div style={css("font-weight:600")}>{order.buyerName || "—"}</div>
          {order.deliverCity ? (
            <div style={css("font-size:12px;color:var(--muted);margin-top:2px")}>
              → {order.deliverCity}
            </div>
          ) : null}
          <button
            onClick={onToggle}
            style={css(
              "margin-top:4px;background:none;border:none;padding:0;font-size:11.5px;color:var(--blueInk);cursor:pointer;text-decoration:underline",
            )}
          >
            {isOpen ? "Hide timeline" : `Timeline (${order.events.length})`}
          </button>
        </td>
        <td style={css(TD)}>
          <div style={css("display:flex;align-items:center;gap:10px")}>
            {order.listingImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={order.listingImage}
                alt=""
                style={css(
                  "width:40px;height:40px;object-fit:cover;border-radius:6px;border:1px solid var(--line);flex:none",
                )}
              />
            ) : null}
            <div style={css("min-width:0")}>
              <div style={css("font-weight:500;line-height:1.3")}>{order.listingTitle}</div>
              <div style={css("font-size:11.5px;color:var(--muted)")}>
                #{order.listingId} · {fmtDate(order.createdAt)}
              </div>
            </div>
          </div>
        </td>
        <td style={css(TD + ";white-space:nowrap;font-weight:600")}>
          {formatPrice(order.priceCents)}
        </td>
        <td style={css(TD + ";white-space:nowrap")}>{formatPrice(order.depositCents)}</td>
        <td style={css(TD + ";white-space:nowrap")}>{formatPrice(order.balanceCents)}</td>
        <td style={css(TD + ";white-space:nowrap")}>
          {order.deliveryFeeCents > 0 ? formatPrice(order.deliveryFeeCents) : "Free"}
        </td>
        <td style={css(TD)}>
          <StatusBadge status={status} />
        </td>
        <td style={css(TD)}>
          {targets.length === 0 ? (
            <span style={css("font-size:12px;color:var(--muted)")}>—</span>
          ) : (
            <select
              disabled={busy}
              value=""
              onChange={(e) => {
                const v = e.target.value;
                if (v && isOrderStatus(v)) onAdvance(v);
              }}
              style={css(
                "border:1px solid var(--line);background:var(--paper);color:var(--ink);padding:6px 8px;border-radius:8px;font-size:12.5px;font-weight:600;cursor:pointer;min-width:130px" +
                  (busy ? ";opacity:0.5;cursor:wait" : ""),
              )}
            >
              <option value="" disabled>
                {busy ? "Saving…" : "Move to…"}
              </option>
              {targets.map((t) => (
                <option key={t} value={t}>
                  {STATUS_LABEL[t]}
                </option>
              ))}
            </select>
          )}
        </td>
      </tr>
      {isOpen ? (
        <tr>
          <td colSpan={8} style={css("padding:0 12px 14px;border-bottom:1px solid var(--line)")}>
            <div
              style={css(
                "background:var(--cream);border:1px solid var(--line);border-radius:10px;padding:12px 14px",
              )}
            >
              {order.events.length === 0 ? (
                <div style={css("font-size:12.5px;color:var(--muted)")}>No events recorded.</div>
              ) : (
                <ol style={css("margin:0;padding:0;list-style:none;display:grid;gap:6px")}>
                  {order.events.map((ev) => (
                    <li
                      key={ev.id}
                      style={css(
                        "display:flex;gap:10px;align-items:baseline;font-size:12.5px;color:var(--ink)",
                      )}
                    >
                      <span style={css("color:var(--muted);min-width:96px;flex:none")}>
                        {fmtDate(ev.at)}
                      </span>
                      <span>{ev.label}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
