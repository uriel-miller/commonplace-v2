"use client";

// OffersList — renders a buyer's or seller's offers.
//   role="seller": Accept / Counter / Decline actions (PATCH /api/offers/[id]).
//   role="buyer" : read-only status badges.
// Self-fetches from /api/offers?role=… on mount (fail-soft to empty), or renders
// a caller-supplied `offers` array. Design-system styled.

import { useCallback, useEffect, useState } from "react";
import { css, sx, Hoverable } from "@/lib/design/css";
import { formatPrice } from "@/lib/listing";
import type { OfferDTO, OfferStatus } from "@/lib/offers";

export interface OffersListProps {
  role: "buyer" | "seller";
  /** Pre-supplied offers; when omitted the component self-fetches. */
  offers?: OfferDTO[];
  /** Buyer identity used to scope the buyer fetch (optional). */
  buyerName?: string;
  /** Notified after any successful mutation with the updated offer. */
  onChanged?: (offer: OfferDTO) => void;
}

const STATUS_STYLE: Record<OfferStatus, string> = {
  pending: "background:var(--yellowBg);color:var(--gold)",
  accepted: "background:var(--greenBg);color:var(--green)",
  countered: "background:var(--blueBg);color:var(--blueInk)",
  declined: "background:var(--tint);color:var(--muted)",
};

const STATUS_LABEL: Record<OfferStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  countered: "Countered",
  declined: "Declined",
};

function StatusBadge({ status }: { status: OfferStatus }) {
  return (
    <span
      style={sx(
        "display:inline-block;padding:3px 10px;border-radius:999px;font-size:11.5px;font-weight:700;letter-spacing:0.02em;text-transform:uppercase",
        STATUS_STYLE[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

/** Prompt for a counter amount (dollars) and return integer cents, or null. */
function promptCounterCents(current: number): number | null {
  const suggested = Math.round(current / 100).toString();
  const raw = typeof window !== "undefined" ? window.prompt("Counter amount ($):", suggested) : null;
  if (raw == null) return null;
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

export default function OffersList({
  role,
  offers: supplied,
  buyerName,
  onChanged,
}: OffersListProps) {
  const [offers, setOffers] = useState<OfferDTO[]>(supplied ?? []);
  const [loading, setLoading] = useState(!supplied);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ role });
      if (role === "buyer" && buyerName) q.set("buyer", buyerName);
      const res = await fetch(`/api/offers?${q.toString()}`, { cache: "no-store" });
      const data = (await res.json()) as { offers?: OfferDTO[] };
      setOffers(Array.isArray(data.offers) ? data.offers : []);
    } catch {
      setOffers([]);
    } finally {
      setLoading(false);
    }
  }, [role, buyerName]);

  // Keep in sync with a controlled `offers` prop, else self-fetch once.
  useEffect(() => {
    if (supplied) {
      setOffers(supplied);
      setLoading(false);
    } else {
      void load();
    }
  }, [supplied, load]);

  const respond = useCallback(
    async (offer: OfferDTO, action: "accept" | "counter" | "decline") => {
      let counterCents: number | undefined;
      if (action === "counter") {
        const c = promptCounterCents(offer.counterCents ?? offer.amountCents);
        if (c == null) return; // cancelled / invalid
        counterCents = c;
      }
      setBusyId(offer.id);
      // Optimistic status update; reconciled with the server response below.
      const optimisticStatus: OfferStatus =
        action === "accept" ? "accepted" : action === "decline" ? "declined" : "countered";
      setOffers((prev) =>
        prev.map((o) =>
          o.id === offer.id
            ? { ...o, status: optimisticStatus, counterCents: counterCents ?? o.counterCents }
            : o,
        ),
      );
      try {
        const res = await fetch(`/api/offers/${offer.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action, counterCents }),
        });
        const data = (await res.json()) as { ok?: boolean; offer?: OfferDTO | null };
        if (res.ok && data.ok && data.offer) {
          const updated = data.offer;
          setOffers((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
          onChanged?.(updated);
        } else {
          // Roll back the optimistic change on failure.
          setOffers((prev) => prev.map((o) => (o.id === offer.id ? offer : o)));
        }
      } catch {
        setOffers((prev) => prev.map((o) => (o.id === offer.id ? offer : o)));
      } finally {
        setBusyId(null);
      }
    },
    [onChanged],
  );

  if (loading && offers.length === 0) {
    return (
      <div style={css("padding:32px 16px;text-align:center;color:var(--muted);font-size:14px")}>
        Loading offers…
      </div>
    );
  }

  if (offers.length === 0) {
    return (
      <div
        style={css(
          "padding:40px 20px;text-align:center;color:var(--muted);border:1px dashed var(--line);border-radius:14px;background:var(--paper)",
        )}
      >
        <div
          style={css(
            "font-family:'Reckless','Newsreader',serif;font-size:17px;color:var(--ink);margin-bottom:4px",
          )}
        >
          {role === "seller" ? "No offers yet" : "You haven't made any offers"}
        </div>
        <div style={css("font-size:13.5px;line-height:1.5")}>
          {role === "seller"
            ? "When a buyer makes an offer, it'll show up here."
            : "Find something you love and make an offer — sellers can accept or counter."}
        </div>
      </div>
    );
  }

  return (
    <div style={css("display:flex;flex-direction:column;gap:12px")}>
      {offers.map((o) => {
        const isBusy = busyId === o.id;
        const actionable = role === "seller" && o.status === "pending";
        return (
          <div
            key={o.id}
            style={css(
              "display:flex;gap:14px;padding:14px;border:1px solid var(--line);border-radius:14px;background:var(--cream)",
            )}
          >
            {/* Thumbnail */}
            {o.listingImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={o.listingImage}
                alt={o.listingTitle}
                style={css(
                  "width:64px;height:64px;object-fit:cover;border-radius:10px;flex:none;background:var(--tint)",
                )}
              />
            ) : (
              <div
                style={css(
                  "width:64px;height:64px;border-radius:10px;flex:none;background:var(--tint)",
                )}
              />
            )}

            <div style={css("flex:1;min-width:0")}>
              <div
                style={css(
                  "display:flex;align-items:flex-start;justify-content:space-between;gap:10px",
                )}
              >
                <div style={css("min-width:0")}>
                  <div
                    style={css(
                      "font-weight:700;font-size:14.5px;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap",
                    )}
                  >
                    {o.listingTitle}
                  </div>
                  <div style={css("font-size:12.5px;color:var(--muted);margin-top:2px")}>
                    {role === "seller" ? o.buyerName : "Your offer"}
                    {o.buyerState ? ` · ${o.buyerState}` : ""}
                  </div>
                </div>
                <StatusBadge status={o.status} />
              </div>

              {/* Price line */}
              <div
                style={css(
                  "display:flex;align-items:baseline;gap:8px;margin-top:8px;flex-wrap:wrap",
                )}
              >
                <span style={css("font-size:17px;font-weight:800;color:var(--ink)")}>
                  {formatPrice(o.amountCents)}
                </span>
                <span style={css("font-size:12.5px;color:var(--muted)")}>
                  of {formatPrice(o.listPriceCents)}
                  {o.pctOfAsking > 0 ? ` · ${o.pctOfAsking}%` : ""}
                </span>
                {o.status === "countered" && o.counterCents != null && (
                  <span style={css("font-size:12.5px;color:var(--blueInk);font-weight:700")}>
                    · countered at {formatPrice(o.counterCents)}
                  </span>
                )}
              </div>

              {o.message && (
                <div
                  style={css(
                    "margin-top:8px;font-size:13px;color:var(--ink);background:var(--paper);border:1px solid var(--line);border-radius:9px;padding:8px 10px;line-height:1.45",
                  )}
                >
                  &ldquo;{o.message}&rdquo;
                </div>
              )}

              {/* Seller actions */}
              {actionable && (
                <div style={css("display:flex;gap:8px;margin-top:12px;flex-wrap:wrap")}>
                  <Hoverable
                    as="button"
                    disabled={isBusy}
                    onClick={() => respond(o, "accept")}
                    styles={sx(
                      "padding:9px 16px;border-radius:9px;border:none;font-weight:700;font-size:13px;cursor:pointer;color:var(--cream);background:var(--green)",
                      isBusy && "opacity:0.5;cursor:wait",
                    )}
                    hover={isBusy ? "" : "background:var(--ink)"}
                  >
                    Accept
                  </Hoverable>
                  <Hoverable
                    as="button"
                    disabled={isBusy}
                    onClick={() => respond(o, "counter")}
                    styles={sx(
                      "padding:9px 16px;border-radius:9px;border:1px solid var(--line);font-weight:700;font-size:13px;cursor:pointer;color:var(--ink);background:var(--paper)",
                      isBusy && "opacity:0.5;cursor:wait",
                    )}
                    hover={isBusy ? "" : "background:var(--tint)"}
                  >
                    Counter
                  </Hoverable>
                  <Hoverable
                    as="button"
                    disabled={isBusy}
                    onClick={() => respond(o, "decline")}
                    styles={sx(
                      "padding:9px 16px;border-radius:9px;border:1px solid var(--line);font-weight:700;font-size:13px;cursor:pointer;color:var(--red);background:var(--paper)",
                      isBusy && "opacity:0.5;cursor:wait",
                    )}
                    hover={isBusy ? "" : "background:var(--tint)"}
                  >
                    Decline
                  </Hoverable>
                </div>
              )}

              {/* Buyer-side hint when the seller has countered */}
              {role === "buyer" && o.status === "countered" && o.counterCents != null && (
                <div style={css("margin-top:10px;font-size:13px;color:var(--blueInk);font-weight:600")}>
                  Seller countered at {formatPrice(o.counterCents)}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
