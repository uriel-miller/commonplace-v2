"use client";

// OffersAdmin — dense admin table of every offer with Accept / Counter / Decline.
// Self-fetches from GET /api/admin/offers (fail-soft to empty). Responses reuse
// the existing PATCH /api/offers/[id] route. Money shown via @/lib/fees +
// formatPrice; all amounts are integer cents.

import { useCallback, useEffect, useMemo, useState } from "react";
import { css, sx, Hoverable } from "@/lib/design/css";
import { formatPrice } from "@/lib/listing";
import type { OfferDTO, OfferStatus } from "@/lib/offers";

/* -------------------------------- display --------------------------------- */

const STATUS_LABEL: Record<OfferStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  countered: "Countered",
  declined: "Declined",
};

const STATUS_STYLE: Record<OfferStatus, string> = {
  pending: "background:var(--yellowBg);color:var(--gold)",
  accepted: "background:var(--greenBg);color:var(--green)",
  countered: "background:var(--blueBg);color:var(--blueInk)",
  declined: "background:var(--tint);color:var(--muted)",
};

function StatusBadge({ status }: { status: OfferStatus }) {
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

/** Prompt for a counter amount (dollars) → integer cents, or null if cancelled. */
function promptCounterCents(current: number): number | null {
  const suggested = Math.round(current / 100).toString();
  const raw =
    typeof window !== "undefined" ? window.prompt("Counter amount ($):", suggested) : null;
  if (raw == null) return null;
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

const TH =
  "text-align:left;padding:10px 12px;font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:var(--muted);border-bottom:1px solid var(--line);white-space:nowrap";
const TD =
  "padding:12px;font-size:13.5px;color:var(--ink);border-bottom:1px solid var(--line);vertical-align:middle";

/* ------------------------------- component -------------------------------- */

export default function OffersAdmin() {
  const [offers, setOffers] = useState<OfferDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/offers", { cache: "no-store" });
      const data = (await res.json()) as { ok?: boolean; offers?: OfferDTO[] };
      if (!res.ok || !data.ok) {
        setError(res.status === 401 ? "Not authorized." : "Could not load offers.");
        setOffers([]);
      } else {
        setOffers(Array.isArray(data.offers) ? data.offers : []);
      }
    } catch {
      setError("Network error loading offers.");
      setOffers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const respond = useCallback(
    async (offer: OfferDTO, action: "accept" | "counter" | "decline") => {
      let counterCents: number | undefined;
      if (action === "counter") {
        const c = promptCounterCents(offer.counterCents ?? offer.amountCents);
        if (c == null) return; // cancelled
        counterCents = c;
      }
      setBusyId(offer.id);
      try {
        const res = await fetch(`/api/offers/${encodeURIComponent(offer.id)}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action, counterCents }),
        });
        const data = (await res.json()) as { ok?: boolean; offer?: OfferDTO | null };
        if (res.ok && data.ok && data.offer) {
          const updated = data.offer;
          setOffers((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
        } else {
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

  const pendingCount = useMemo(
    () => offers.filter((o) => o.status === "pending").length,
    [offers],
  );

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
            Offers
          </h2>
          <p style={css("margin:2px 0 0;font-size:13px;color:var(--muted)")}>
            {offers.length} total · {pendingCount} pending
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
        <div style={css("padding:24px;color:var(--muted);font-size:14px")}>Loading offers…</div>
      ) : offers.length === 0 ? (
        <div
          style={css(
            "padding:32px;text-align:center;color:var(--muted);font-size:14px;border:1px dashed var(--line);border-radius:12px",
          )}
        >
          No offers yet.
        </div>
      ) : (
        <div
          style={css(
            "overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:var(--paper)",
          )}
        >
          <table style={css("width:100%;border-collapse:collapse;min-width:820px")}>
            <thead>
              <tr>
                <th style={css(TH)}>Buyer</th>
                <th style={css(TH)}>Item</th>
                <th style={css(TH)}>Asking</th>
                <th style={css(TH)}>Offer</th>
                <th style={css(TH)}>% Ask</th>
                <th style={css(TH)}>Status</th>
                <th style={css(TH)}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {offers.map((o) => {
                const busy = busyId === o.id;
                const actionable = o.status === "pending" || o.status === "countered";
                return (
                  <tr key={o.id}>
                    <td style={css(TD)}>
                      <div style={css("font-weight:600")}>{o.buyerName || "—"}</div>
                      {o.buyerState ? (
                        <div style={css("font-size:12px;color:var(--muted);margin-top:2px")}>
                          {o.buyerState}
                        </div>
                      ) : null}
                      <div style={css("font-size:11.5px;color:var(--muted);margin-top:2px")}>
                        {fmtDate(o.createdAt)}
                      </div>
                    </td>
                    <td style={css(TD)}>
                      <div style={css("display:flex;align-items:center;gap:10px")}>
                        {o.listingImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={o.listingImage}
                            alt=""
                            style={css(
                              "width:40px;height:40px;object-fit:cover;border-radius:6px;border:1px solid var(--line);flex:none",
                            )}
                          />
                        ) : null}
                        <div style={css("min-width:0")}>
                          <div style={css("font-weight:500;line-height:1.3")}>
                            {o.listingTitle}
                          </div>
                          <div style={css("font-size:11.5px;color:var(--muted)")}>
                            #{o.listingId}
                          </div>
                        </div>
                      </div>
                      {o.message ? (
                        <div
                          style={css(
                            "margin-top:6px;font-size:12px;color:var(--muted);font-style:italic;max-width:280px",
                          )}
                        >
                          “{o.message}”
                        </div>
                      ) : null}
                    </td>
                    <td style={css(TD + ";white-space:nowrap")}>
                      {formatPrice(o.listPriceCents)}
                    </td>
                    <td style={css(TD + ";white-space:nowrap;font-weight:600")}>
                      {formatPrice(o.amountCents)}
                      {o.counterCents != null ? (
                        <div style={css("font-size:11.5px;color:var(--blueInk);font-weight:600")}>
                          counter {formatPrice(o.counterCents)}
                        </div>
                      ) : null}
                    </td>
                    <td style={css(TD + ";white-space:nowrap")}>{o.pctOfAsking}%</td>
                    <td style={css(TD)}>
                      <StatusBadge status={o.status} />
                    </td>
                    <td style={css(TD)}>
                      {actionable ? (
                        <div style={css("display:flex;gap:6px;flex-wrap:wrap")}>
                          <Hoverable
                            as="button"
                            disabled={busy}
                            onClick={() => void respond(o, "accept")}
                            styles={
                              "border:1px solid var(--green);background:var(--greenBg);color:var(--green);padding:5px 11px;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer" +
                              (busy ? ";opacity:0.5;cursor:wait" : "")
                            }
                            hover="filter:brightness(0.97)"
                          >
                            Accept
                          </Hoverable>
                          <Hoverable
                            as="button"
                            disabled={busy}
                            onClick={() => void respond(o, "counter")}
                            styles={
                              "border:1px solid var(--blueInk);background:var(--blueBg);color:var(--blueInk);padding:5px 11px;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer" +
                              (busy ? ";opacity:0.5;cursor:wait" : "")
                            }
                            hover="filter:brightness(0.97)"
                          >
                            Counter
                          </Hoverable>
                          <Hoverable
                            as="button"
                            disabled={busy}
                            onClick={() => void respond(o, "decline")}
                            styles={
                              "border:1px solid var(--line);background:var(--paper);color:var(--muted);padding:5px 11px;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer" +
                              (busy ? ";opacity:0.5;cursor:wait" : "")
                            }
                            hover="background:var(--tint)"
                          >
                            Decline
                          </Hoverable>
                        </div>
                      ) : (
                        <span style={css("font-size:12px;color:var(--muted)")}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
