"use client";

// DashboardOverview — the admin home panel. Fetches /api/admin/stats and renders
// KPI tiles (Total listings, Live GMV, Open offers, Orders total) plus an
// Orders-by-status strip and a recent-orders table. On-brand, dense, tabular.
//
// Robustness: the fetch fail-softs to a zeroed shape so the panel always renders,
// never throws, and shows a quiet retry affordance on error. Money is in cents.

import { useCallback, useEffect, useState } from "react";
import { css, sx, Hoverable } from "@/lib/design/css";
import { formatPrice } from "@/lib/listing";

/* ------------------------------- types (local) ------------------------------ */
// Mirrors the /api/admin/stats response. Defined locally so the client bundle
// never imports the server route module.

interface AdminRecentOrder {
  id: string;
  listingTitle: string;
  buyerName: string;
  priceCents: number;
  status: string;
  createdAt: string;
}

interface AdminStats {
  listings: number;
  categories: number;
  offers: { total: number; pending: number; accepted: number };
  orders: { total: number; gmvCents: number; byStatus: Record<string, number> };
  recentOrders: AdminRecentOrder[];
}

function emptyStats(): AdminStats {
  return {
    listings: 0,
    categories: 0,
    offers: { total: 0, pending: 0, accepted: 0 },
    orders: { total: 0, gmvCents: 0, byStatus: {} },
    recentOrders: [],
  };
}

/* --------------------------------- helpers ---------------------------------- */

// Canonical order lifecycle + a color per state, on-brand via CSS vars.
const STATUS_ORDER = [
  "reserved",
  "scheduled",
  "picked_up",
  "in_transit",
  "delivered",
  "paid",
  "cancelled",
] as const;

const STATUS_COLOR: Record<string, string> = {
  reserved: "var(--blueInk)",
  scheduled: "var(--blueInk)",
  picked_up: "var(--gold)",
  in_transit: "var(--gold)",
  delivered: "var(--green)",
  paid: "var(--green)",
  cancelled: "var(--muted)",
};

function statusLabel(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusColor(s: string): string {
  return STATUS_COLOR[s] ?? "var(--ink)";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Merge known statuses (in lifecycle order) with any unexpected ones from the API.
function orderedStatuses(byStatus: Record<string, number>): string[] {
  const known = STATUS_ORDER.filter((s) => byStatus[s] !== undefined);
  const extra = Object.keys(byStatus).filter(
    (s) => !(STATUS_ORDER as readonly string[]).includes(s),
  );
  return [...known, ...extra];
}

/* ---------------------------------- styles ---------------------------------- */

const headingFont = "font-family:'Reckless','Newsreader',serif";

/* ------------------------------- subcomponents ------------------------------ */

function KpiTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: string;
}) {
  return (
    <div
      style={sx(
        "background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:18px 20px;display:flex;flex-direction:column;gap:6px;min-width:0",
        { borderTop: `3px solid ${accent}` },
      )}
    >
      <span
        style={css(
          "font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600",
        )}
      >
        {label}
      </span>
      <span
        style={sx(headingFont, "font-size:30px;line-height:1.05;color:var(--ink)", {
          fontWeight: 600,
        })}
      >
        {value}
      </span>
      {sub ? (
        <span style={css("font-size:12px;color:var(--muted)")}>{sub}</span>
      ) : null}
    </div>
  );
}

/* -------------------------------- component --------------------------------- */

export default function DashboardOverview() {
  const [stats, setStats] = useState<AdminStats>(emptyStats());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/admin/stats", {
        method: "GET",
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      if (res.status === 401) {
        setError(true);
        setStats(emptyStats());
        return;
      }
      const data = (await res.json()) as Partial<AdminStats> | null;
      // Defensively merge onto a full shape so a partial body can't crash render.
      const base = emptyStats();
      setStats({
        listings: data?.listings ?? base.listings,
        categories: data?.categories ?? base.categories,
        offers: { ...base.offers, ...(data?.offers ?? {}) },
        orders: {
          total: data?.orders?.total ?? base.orders.total,
          gmvCents: data?.orders?.gmvCents ?? base.orders.gmvCents,
          byStatus: data?.orders?.byStatus ?? base.orders.byStatus,
        },
        recentOrders: Array.isArray(data?.recentOrders) ? data!.recentOrders! : [],
      });
    } catch (err) {
      console.warn("[DashboardOverview] fetch failed", err);
      setError(true);
      setStats(emptyStats());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const statuses = orderedStatuses(stats.orders.byStatus);

  return (
    <div style={css("display:flex;flex-direction:column;gap:22px;color:var(--ink)")}>
      {/* Header */}
      <div
        style={css(
          "display:flex;align-items:baseline;justify-content:space-between;gap:16px;flex-wrap:wrap",
        )}
      >
        <div style={css("display:flex;flex-direction:column;gap:2px")}>
          <h1 style={sx(headingFont, "font-size:26px;margin:0;color:var(--ink)", { fontWeight: 600 })}>
            Overview
          </h1>
          <span style={css("font-size:13px;color:var(--muted)")}>
            {loading ? "Refreshing…" : "Marketplace at a glance"}
          </span>
        </div>
        <Hoverable
          as="button"
          onClick={() => void load()}
          styles="background:var(--ink);color:var(--cream);border:none;border-radius:8px;padding:9px 16px;font-size:13px;font-weight:600;cursor:pointer;letter-spacing:.01em"
          hover="opacity:.88"
        >
          Refresh
        </Hoverable>
      </div>

      {error ? (
        <div
          style={css(
            "background:var(--paper);border:1px solid var(--maroon);border-radius:10px;padding:12px 16px;font-size:13px;color:var(--maroon)",
          )}
        >
          Couldn&apos;t load stats. They may be unavailable or your session expired.{" "}
          <button
            onClick={() => void load()}
            style={css(
              "background:none;border:none;color:var(--maroon);text-decoration:underline;cursor:pointer;font-size:13px;padding:0",
            )}
          >
            Try again
          </button>
        </div>
      ) : null}

      {/* KPI tiles */}
      <div
        style={css(
          "display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px",
        )}
      >
        <KpiTile
          label="Total listings"
          value={stats.listings.toLocaleString("en-US")}
          sub={`${stats.categories.toLocaleString("en-US")} categories`}
          accent="var(--blueInk)"
        />
        <KpiTile
          label="Live GMV"
          value={formatPrice(stats.orders.gmvCents)}
          sub={`${stats.orders.total.toLocaleString("en-US")} orders`}
          accent="var(--green)"
        />
        <KpiTile
          label="Open offers"
          value={stats.offers.pending.toLocaleString("en-US")}
          sub={`${stats.offers.total.toLocaleString("en-US")} total · ${stats.offers.accepted.toLocaleString("en-US")} accepted`}
          accent="var(--gold)"
        />
        <KpiTile
          label="Orders"
          value={stats.orders.total.toLocaleString("en-US")}
          sub={`${(stats.orders.byStatus["delivered"] ?? 0) + (stats.orders.byStatus["paid"] ?? 0)} completed`}
          accent="var(--maroon)"
        />
      </div>

      {/* Orders by status */}
      <section style={css("display:flex;flex-direction:column;gap:10px")}>
        <h2 style={sx(headingFont, "font-size:16px;margin:0;color:var(--ink)", { fontWeight: 600 })}>
          Orders by status
        </h2>
        {statuses.length === 0 ? (
          <p style={css("font-size:13px;color:var(--muted);margin:0")}>No orders yet.</p>
        ) : (
          <div style={css("display:flex;flex-wrap:wrap;gap:10px")}>
            {statuses.map((s) => (
              <div
                key={s}
                style={sx(
                  "display:flex;align-items:center;gap:8px;background:var(--paper);border:1px solid var(--line);border-radius:999px;padding:6px 14px 6px 12px;font-size:13px",
                )}
              >
                <span
                  style={sx("width:8px;height:8px;border-radius:999px", {
                    background: statusColor(s),
                  })}
                />
                <span style={css("color:var(--muted)")}>{statusLabel(s)}</span>
                <span style={sx("color:var(--ink)", { fontWeight: 700 })}>
                  {(stats.orders.byStatus[s] ?? 0).toLocaleString("en-US")}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent orders table */}
      <section style={css("display:flex;flex-direction:column;gap:10px")}>
        <h2 style={sx(headingFont, "font-size:16px;margin:0;color:var(--ink)", { fontWeight: 600 })}>
          Recent orders
        </h2>
        <div
          style={css(
            "background:var(--paper);border:1px solid var(--line);border-radius:12px;overflow:hidden",
          )}
        >
          <div style={css("overflow-x:auto")}>
            <table
              style={css(
                "width:100%;border-collapse:collapse;font-size:13px;min-width:560px",
              )}
            >
              <thead>
                <tr>
                  {["Order", "Buyer", "Item", "Amount", "Status", "Date"].map((h, i) => (
                    <th
                      key={h}
                      style={sx(
                        "text-align:left;padding:10px 14px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);font-weight:600;border-bottom:1px solid var(--line);white-space:nowrap",
                        i === 3 ? { textAlign: "right" } : undefined,
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.recentOrders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      style={css(
                        "padding:22px 14px;text-align:center;color:var(--muted);font-size:13px",
                      )}
                    >
                      {loading ? "Loading orders…" : "No recent orders."}
                    </td>
                  </tr>
                ) : (
                  stats.recentOrders.map((o) => (
                    <tr key={o.id}>
                      <td
                        style={css(
                          "padding:11px 14px;border-bottom:1px solid var(--line);color:var(--muted);font-family:ui-monospace,monospace;white-space:nowrap",
                        )}
                      >
                        {o.id.slice(0, 8)}
                      </td>
                      <td
                        style={css(
                          "padding:11px 14px;border-bottom:1px solid var(--line);color:var(--ink);white-space:nowrap",
                        )}
                      >
                        {o.buyerName || "—"}
                      </td>
                      <td
                        style={sx(
                          "padding:11px 14px;border-bottom:1px solid var(--line);color:var(--ink);max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap",
                        )}
                        title={o.listingTitle}
                      >
                        {o.listingTitle || "—"}
                      </td>
                      <td
                        style={sx(
                          "padding:11px 14px;border-bottom:1px solid var(--line);color:var(--ink);text-align:right;white-space:nowrap",
                          { fontVariantNumeric: "tabular-nums", fontWeight: 600 },
                        )}
                      >
                        {formatPrice(o.priceCents)}
                      </td>
                      <td
                        style={css(
                          "padding:11px 14px;border-bottom:1px solid var(--line);white-space:nowrap",
                        )}
                      >
                        <span style={css("display:inline-flex;align-items:center;gap:7px")}>
                          <span
                            style={sx("width:7px;height:7px;border-radius:999px", {
                              background: statusColor(o.status),
                            })}
                          />
                          <span style={css("color:var(--ink)")}>{statusLabel(o.status)}</span>
                        </span>
                      </td>
                      <td
                        style={css(
                          "padding:11px 14px;border-bottom:1px solid var(--line);color:var(--muted);white-space:nowrap",
                        )}
                      >
                        {formatDate(o.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
