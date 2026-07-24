"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { css, sx } from "@/lib/design/css";
import { formatPrice } from "@/lib/listing";

/**
 * Cart-exit "save $X" popup — a 1:1 port of the live `tms-cart-exit-popup`
 * (v1.1.3) exit-intent floor-price offer. Shows once per session when the
 * shopper tries to leave the cart with unclaimed savings, offering to unlock
 * a discount in exchange for their email.
 *
 * Self-contained: no backend call is made. Submitting the email transitions
 * to a success state purely in the UI (the live plugin generates a one-time
 * WooCommerce coupon server-side; that is wired separately). Everything is
 * fail-soft — nothing here throws to the user.
 */

/** Sessionwide suppression flag — mirrors the live `tms_popup_dismissed`. */
const DISMISS_KEY = "tms_popup_dismissed";
/** Idle time before the popup auto-triggers (live INACTIVITY_SEC ≈ 30s). */
const INACTIVITY_MS = 30_000;
/** Sensible fallback offer when no floor savings were passed in. */
const DEFAULT_SAVINGS_CENTS = 15_000; // $150

type Status = "idle" | "loading" | "success";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Read the session dismissal flag, guarding SSR / privacy-mode throws. */
function alreadyDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/** Persist the session dismissal flag, swallowing any storage error. */
function markDismissed(): void {
  try {
    sessionStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* storage unavailable — non-fatal, popup simply may reshow next load */
  }
}

export function CartExitPopup({
  enabled,
  savingsCents,
  onClose,
}: {
  enabled: boolean;
  savingsCents?: number;
  onClose: () => void;
}) {
  const savings =
    typeof savingsCents === "number" && Number.isFinite(savingsCents) && savingsCents > 0
      ? Math.round(savingsCents)
      : DEFAULT_SAVINGS_CENTS;
  const savingsLabel = formatPrice(savings);

  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const shownRef = useRef(false);

  // Trigger: exit-intent (pointer leaves the viewport top) OR ~30s inactivity.
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    if (alreadyDismissed()) return;

    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const trigger = () => {
      if (disposed || shownRef.current) return;
      shownRef.current = true;
      setOpen(true);
      cleanup();
    };

    const onMouseOut = (e: MouseEvent) => {
      // Pointer left through the top edge of the document.
      if (!e.relatedTarget && e.clientY <= 0) trigger();
    };

    const resetIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(trigger, INACTIVITY_MS);
    };

    const activityEvents: (keyof DocumentEventMap)[] = [
      "mousemove",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ];

    function cleanup() {
      if (idleTimer) clearTimeout(idleTimer);
      document.removeEventListener("mouseout", onMouseOut);
      for (const ev of activityEvents) document.removeEventListener(ev, resetIdle);
    }

    try {
      document.addEventListener("mouseout", onMouseOut);
      for (const ev of activityEvents) {
        document.addEventListener(ev, resetIdle, { passive: true });
      }
      resetIdle();
    } catch {
      /* listener attach failed — popup just won't trigger, no crash */
    }

    return () => {
      disposed = true;
      cleanup();
    };
  }, [enabled]);

  const dismiss = useCallback(() => {
    markDismissed();
    setOpen(false);
    try {
      onClose();
    } catch {
      /* parent handler must never break the close */
    }
  }, [onClose]);

  // Escape-to-close while the dialog is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, dismiss]);

  const submit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (status === "loading") return;
      const value = email.trim();
      if (!EMAIL_RE.test(value)) {
        setError("Please enter a valid email address.");
        return;
      }
      setError(null);
      setStatus("loading");
      // No real backend in this rebuild — simulate the unlock, then show
      // the success state. Wrapped so a timer/DOM hiccup can't throw out.
      try {
        window.setTimeout(() => {
          setStatus("success");
          markDismissed();
        }, 900);
      } catch {
        setStatus("success");
        markDismissed();
      }
    },
    [email, status],
  );

  if (!open) return null;

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
      style={css(
        "position:fixed;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.55);animation:cmpPopupFade .18s ease-out;",
      )}
    >
      <style>{KEYFRAMES}</style>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={status === "success" ? "Savings applied" : "Unlock savings"}
        style={css(
          "position:relative;width:100%;max-width:480px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.2);animation:cmpPopupScale .2s cubic-bezier(.16,1,.3,1);",
        )}
      >
        {/* 4px maroon accent bar */}
        <div style={css("height:4px;background:#630E3D;")} />

        {/* Close button */}
        <button
          type="button"
          aria-label="Close"
          onClick={dismiss}
          style={css(
            "position:absolute;top:16px;right:16px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border:0;border-radius:50%;background:#F0F0F0;color:#555;cursor:pointer;padding:0;",
          )}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path
              d="M1 1L11 11M11 1L1 11"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>

        {status === "success" ? (
          <div
            style={css(
              "padding:40px 36px 44px;display:flex;flex-direction:column;align-items:center;text-align:center;",
            )}
          >
            <div
              style={css(
                "width:64px;height:64px;border-radius:50%;background:#E8F5EE;display:flex;align-items:center;justify-content:center;margin-bottom:20px;",
              )}
            >
              <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
                <path
                  d="M7 15.5L12.5 21L23 9"
                  stroke="#2D8B5F"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h3
              style={css(
                "margin:0 0 8px;font-family:'Newsreader',Georgia,serif;font-size:26px;font-weight:600;color:#1a1a1a;",
              )}
            >
              Savings applied!
            </h3>
            <p style={css("margin:0 0 14px;font-size:15px;line-height:1.5;color:#555;")}>
              Your {savingsLabel} discount has been applied to your cart.
            </p>
            <p style={css("margin:0;font-size:13px;color:#999;")}>Refreshing your cart…</p>
          </div>
        ) : (
          <div style={css("padding:32px 36px 36px;")}>
            <h2
              style={css(
                "margin:0 0 10px;font-family:'Newsreader',Georgia,serif;font-size:30px;line-height:1.15;font-weight:600;color:#1a1a1a;",
              )}
            >
              Want to save {savingsLabel}? Yes, really.
            </h2>
            <p style={css("margin:0 0 18px;font-size:15px;line-height:1.5;color:#555;")}>
              Enter your email to unlock {savingsLabel} in savings on this item.
            </p>

            <div
              style={css(
                "display:flex;justify-content:center;margin:0 0 20px;padding:12px 20px;background:#63BBFF;border-radius:50px;text-align:center;",
              )}
            >
              <span style={css("font-size:18px;font-weight:700;color:#000;")}>
                Your total savings: {savingsLabel} off
              </span>
            </div>

            <form onSubmit={submit} noValidate>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="Enter your email to unlock savings"
                aria-label="Email address"
                aria-invalid={error ? true : undefined}
                disabled={status === "loading"}
                style={sx(
                  "width:100%;box-sizing:border-box;height:52px;padding:0 16px;font-size:16px;color:#1a1a1a;background:#fff;border:1px solid #E6E6E6;border-radius:10px;outline:none;",
                  focused && "border:1px solid #630E3D;box-shadow:0 0 0 4px rgba(99,14,61,.12);",
                  !!error && "border:1px solid #D4183D;",
                )}
              />

              {error ? (
                <p style={css("margin:8px 0 0;font-size:13px;color:#C0392B;")}>{error}</p>
              ) : null}

              <button
                type="submit"
                disabled={status === "loading"}
                style={css(
                  `width:100%;height:52px;margin-top:14px;border:0;border-radius:10px;background:#630E3D;color:#fff;font-size:16px;font-weight:600;cursor:${
                    status === "loading" ? "default" : "pointer"
                  };opacity:${status === "loading" ? "0.75" : "1"};`,
                )}
              >
                {status === "loading" ? "Applying savings…" : "Unlock My Savings"}
              </button>
            </form>

            <div style={css("text-align:center;margin-top:16px;")}>
              <button
                type="button"
                onClick={dismiss}
                style={css(
                  "border:0;background:none;padding:0;font-size:14px;color:#888;text-decoration:underline;cursor:pointer;",
                )}
              >
                No thanks, I&apos;ll pay full price
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const KEYFRAMES = `
@keyframes cmpPopupFade { from { opacity: 0 } to { opacity: 1 } }
@keyframes cmpPopupScale { from { opacity: 0; transform: scale(.95) } to { opacity: 1; transform: scale(1) } }
`;

export default CartExitPopup;
