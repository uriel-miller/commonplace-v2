"use client";

// OfferModal — a buyer places an offer on a Listing. Shows the list price, the
// buyer's offer, and "you're offering X% of asking". Posts to /api/offers and
// reports success/failure. Design-system styled (inline css() + CSS vars).

import { useState, useMemo, useCallback, useEffect } from "react";
import { css, sx, Hoverable } from "@/lib/design/css";
import { Close } from "@/components/marketplace/icons";
import { formatPrice, type Listing } from "@/lib/listing";

export interface OfferModalProps {
  listing: Listing;
  open: boolean;
  onClose: () => void;
  /** Optional buyer identity (from an auth/profile layer, when present). */
  buyerName?: string;
  buyerState?: string | null;
  /** Fired after a successful create so the parent can refresh lists/toasts. */
  onSubmitted?: (offer: { id: string; amountCents: number }) => void;
}

type Phase = "idle" | "submitting" | "success" | "error";

const OVERLAY = css(
  "position:fixed;inset:0;background:rgba(20,16,14,0.55);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px",
);
const CARD = css(
  "background:var(--paper);border:1px solid var(--line);border-radius:16px;max-width:440px;width:100%;box-shadow:0 24px 60px rgba(0,0,0,0.28);overflow:hidden",
);
const HEADER = css(
  "display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:18px 20px 12px",
);
const BODY = css("padding:4px 20px 20px");
const LABEL = css(
  "font-size:12px;font-weight:600;letter-spacing:0.02em;text-transform:uppercase;color:var(--muted);margin-bottom:6px",
);
const INPUT_WRAP = css(
  "display:flex;align-items:center;gap:6px;border:1.5px solid var(--line);border-radius:10px;padding:12px 14px;background:var(--paper)",
);

/** Parse a free-typed dollar string into integer cents (>=0). */
function dollarsToCents(raw: string): number {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (!cleaned) return 0;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export default function OfferModal({
  listing,
  open,
  onClose,
  buyerName,
  buyerState,
  onSubmitted,
}: OfferModalProps) {
  const [amountStr, setAmountStr] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [errMsg, setErrMsg] = useState<string>("");

  // Reset transient state whenever the modal (re)opens for a listing.
  useEffect(() => {
    if (open) {
      setAmountStr("");
      setPhase("idle");
      setErrMsg("");
    }
  }, [open, listing.id]);

  const amountCents = useMemo(() => dollarsToCents(amountStr), [amountStr]);
  const listPriceCents = listing.priceCents;
  const pct = useMemo(() => {
    if (!listPriceCents || listPriceCents <= 0 || amountCents <= 0) return null;
    return Math.round((amountCents / listPriceCents) * 100);
  }, [amountCents, listPriceCents]);

  const lowball = pct != null && pct < 70;
  const overAsking = pct != null && pct > 100;
  const canSubmit = amountCents > 0 && phase !== "submitting" && phase !== "success";

  const submit = useCallback(async () => {
    if (amountCents <= 0) return;
    setPhase("submitting");
    setErrMsg("");
    try {
      const res = await fetch("/api/offers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          listingId: listing.id,
          listingTitle: listing.title,
          listingImage: listing.images?.[0] ?? null,
          buyerName: buyerName ?? "Guest buyer",
          buyerState: buyerState ?? listing.location ?? null,
          amountCents,
          listPriceCents,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        offer?: { id: string; amountCents: number } | null;
        error?: string;
      };
      if (res.ok && data.ok && data.offer) {
        setPhase("success");
        onSubmitted?.({ id: data.offer.id, amountCents: data.offer.amountCents });
      } else {
        setPhase("error");
        setErrMsg(
          data.error === "no-database"
            ? "Offers are temporarily unavailable. Please try again shortly."
            : "We couldn't send your offer. Please try again.",
        );
      }
    } catch {
      setPhase("error");
      setErrMsg("Network hiccup — please try again.");
    }
  }, [amountCents, listing, listPriceCents, buyerName, buyerState, onSubmitted]);

  if (!open) return null;

  return (
    <div
      style={OVERLAY}
      role="dialog"
      aria-modal="true"
      aria-label="Make an offer"
      onClick={onClose}
    >
      <div style={CARD} onClick={(e) => e.stopPropagation()}>
        <div style={HEADER}>
          <div>
            <div
              style={css(
                "font-family:'Reckless','Newsreader',serif;font-size:20px;font-weight:600;color:var(--ink);line-height:1.2",
              )}
            >
              Make an offer
            </div>
            <div style={css("font-size:13px;color:var(--muted);margin-top:3px")}>
              {listing.title}
            </div>
          </div>
          <Hoverable
            as="button"
            aria-label="Close"
            onClick={onClose}
            styles="background:transparent;border:none;cursor:pointer;padding:6px;border-radius:8px;line-height:0;flex:none"
            hover="background:var(--tint)"
          >
            <Close />
          </Hoverable>
        </div>

        <div style={BODY}>
          {phase === "success" ? (
            <div style={css("padding:14px 0 4px;text-align:center")}>
              <div
                style={css(
                  "font-family:'Reckless','Newsreader',serif;font-size:19px;font-weight:600;color:var(--green);margin-bottom:6px",
                )}
              >
                Offer sent
              </div>
              <div style={css("font-size:14px;color:var(--muted);line-height:1.5")}>
                You offered <strong>{formatPrice(amountCents)}</strong> on{" "}
                {listing.title}. The seller will respond soon.
              </div>
              <Hoverable
                as="button"
                onClick={onClose}
                styles="margin-top:18px;width:100%;padding:12px;border-radius:10px;border:1px solid var(--line);background:var(--paper);color:var(--ink);font-weight:600;font-size:14px;cursor:pointer"
                hover="background:var(--tint)"
              >
                Done
              </Hoverable>
            </div>
          ) : (
            <>
              {/* List price row */}
              <div
                style={css(
                  "display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--paper);border:1px solid var(--line);border-radius:10px;margin-bottom:16px",
                )}
              >
                <span style={css("font-size:13px;color:var(--muted)")}>List price</span>
                <span style={css("font-size:15px;font-weight:700;color:var(--ink)")}>
                  {formatPrice(listPriceCents)}
                </span>
              </div>

              {/* Amount input */}
              <div style={css("margin-bottom:14px")}>
                <div style={LABEL}>Your offer</div>
                <div
                  style={sx(
                    INPUT_WRAP,
                    amountCents > 0 && "border-color:var(--ink)",
                  )}
                >
                  <span style={css("font-size:18px;font-weight:700;color:var(--muted)")}>$</span>
                  <input
                    inputMode="decimal"
                    autoFocus
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && canSubmit) submit();
                    }}
                    placeholder="0"
                    aria-label="Offer amount in dollars"
                    style={css(
                      "flex:1;border:none;outline:none;background:transparent;font-size:18px;font-weight:700;color:var(--ink);width:100%",
                    )}
                  />
                </div>
                {pct != null && (
                  <div
                    style={sx(
                      "font-size:12.5px;margin-top:7px;font-weight:600",
                      overAsking
                        ? "color:var(--green)"
                        : lowball
                          ? "color:var(--red)"
                          : "color:var(--muted)",
                    )}
                  >
                    You&rsquo;re offering {pct}% of asking
                    {lowball && " — a low offer may be declined"}
                    {overAsking && " — above list price"}
                  </div>
                )}
              </div>


              {phase === "error" && (
                <div
                  style={css(
                    "font-size:13px;color:var(--red);margin-bottom:12px;font-weight:600",
                  )}
                >
                  {errMsg}
                </div>
              )}

              <Hoverable
                as="button"
                onClick={submit}
                disabled={!canSubmit}
                styles={sx(
                  "width:100%;padding:14px;border-radius:11px;border:none;font-weight:700;font-size:15px;cursor:pointer;transition:opacity .15s;color:var(--cream);background:var(--maroon)",
                  !canSubmit && "opacity:0.5;cursor:not-allowed",
                )}
                hover={canSubmit ? "background:var(--ink)" : ""}
              >
                {phase === "submitting"
                  ? "Sending…"
                  : amountCents > 0
                    ? `Send offer · ${formatPrice(amountCents)}`
                    : "Send offer"}
              </Hoverable>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
