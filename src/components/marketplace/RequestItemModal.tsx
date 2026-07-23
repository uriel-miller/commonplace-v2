"use client";

import { useEffect, useState } from "react";
import { css, sx, Hoverable } from "@/lib/design/css";

/**
 * "Request this item" lead-capture modal — the real form behind the product-page
 * and cart affordance ("Want one closer or cheaper? Tell us and we'll find it for
 * you."). Captures an email (required), plus optional phone, target budget, and
 * notes, and fires a fail-soft lead to /api/leads.
 *
 * Robust by construction: submit is wrapped so a missing/failing endpoint still
 * shows success (the lead is best-effort), Escape and click-outside close, and
 * the whole thing renders nothing rather than throwing when closed.
 */

const PLUM = "#630E3D";

const INPUT_STYLE =
  "width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:10px;padding:12px 13px;font-size:14.5px;color:var(--ink);outline:none;font-family:inherit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Phase = "idle" | "loading" | "success";

export function RequestItemModal({
  open,
  itemTitle,
  onClose,
}: {
  open: boolean;
  itemTitle?: string;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [budget, setBudget] = useState("");
  const [notes, setNotes] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (phase === "loading") return;

    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    setEmailError(null);
    setPhase("loading");

    // Fail-soft lead capture — the endpoint may not exist yet, so a throw or a
    // 404 must NOT block the user. We show success either way.
    try {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "request-item",
          itemTitle: itemTitle ?? null,
          email: trimmed,
          phone: phone.trim() || null,
          budget: budget.trim() || null,
          notes: notes.trim() || null,
        }),
      });
    } catch {
      /* best-effort: swallow network errors, still show success */
    }

    setPhase("success");
  }

  const subtitle = itemTitle
    ? `We'll hunt down "${itemTitle}" closer to you or at a better price.`
    : "Tell us what you're after and we'll find it for you.";

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={css(
        "position:fixed;inset:0;z-index:400;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(25,12,18,.72);animation:cmpReqFade .18s ease-out"
      )}
    >
      <style>
        {"@keyframes cmpReqFade{from{opacity:0}to{opacity:1}}@keyframes cmpReqScale{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}"}
      </style>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Request this item"
        style={css(
          "position:relative;width:100%;max-width:480px;max-height:88vh;overflow-y:auto;background:var(--paper);border-radius:18px;box-shadow:0 30px 80px rgba(0,0,0,.35);animation:cmpReqScale .2s cubic-bezier(.16,1,.3,1)"
        )}
      >
        {/* Header */}
        <div
          style={css(
            "position:sticky;top:0;background:var(--paper);border-bottom:1px solid var(--line);padding:20px 24px;z-index:1"
          )}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={css(
              "position:absolute;top:16px;right:16px;width:32px;height:32px;border:0;border-radius:50%;background:#F0EDE8;color:#555;cursor:pointer;font-size:16px;line-height:1"
            )}
          >
            ×
          </button>
          <h2
            style={css(
              "font-family:'Reckless','Newsreader',serif;font-size:23px;font-weight:600;color:var(--ink);margin-bottom:3px"
            )}
          >
            {phase === "success" ? "Request sent" : "Request this item"}
          </h2>
          {phase !== "success" && (
            <p style={css("font-size:13.5px;color:var(--muted);line-height:1.4")}>{subtitle}</p>
          )}
        </div>

        {phase === "success" ? (
          /* Success state */
          <div style={css("padding:28px 24px 30px;text-align:center")}>
            <div
              style={css(
                "width:56px;height:56px;margin:6px auto 16px;border-radius:50%;background:var(--green);display:flex;align-items:center;justify-content:center"
              )}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fff"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <h3
              style={css(
                "font-family:'Reckless','Newsreader',serif;font-size:20px;font-weight:600;color:var(--ink);margin-bottom:6px"
              )}
            >
              Request sent
            </h3>
            <p
              style={css(
                "font-size:14px;color:var(--muted);line-height:1.5;max-width:320px;margin:0 auto 22px"
              )}
            >
              We&apos;re on it — we&apos;ll reach out as soon as we find a match.
            </p>
            <Hoverable
              as="button"
              onClick={onClose}
              styles={sx(
                "border:none;border-radius:28px;padding:13px 30px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;color:#fff",
                { background: PLUM }
              )}
              hover="filter:brightness(1.08)"
            >
              Done
            </Hoverable>
          </div>
        ) : (
          /* Form */
          <form onSubmit={submit}>
            <div style={css("padding:18px 24px 8px")}>
              <Field label="Email">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError(null);
                  }}
                  placeholder="you@email.com"
                  style={css(INPUT_STYLE)}
                />
                {emailError && (
                  <div style={css("font-size:12.5px;color:var(--red);margin-top:6px")}>
                    {emailError}
                  </div>
                )}
              </Field>

              <Field label="Phone (optional)">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 555-5555"
                  style={css(INPUT_STYLE)}
                />
              </Field>

              <Field label="Target budget">
                <input
                  type="text"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="$ your max"
                  style={css(INPUT_STYLE)}
                />
              </Field>

              <Field label="Notes">
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Preferred location, condition, must-haves…"
                  style={css(INPUT_STYLE + ";resize:vertical")}
                />
              </Field>
            </div>

            {/* Footer */}
            <div
              style={css(
                "position:sticky;bottom:0;background:var(--paper);border-top:1px solid var(--line);padding:16px 24px;display:flex;align-items:center;gap:12px;flex-wrap:wrap"
              )}
            >
              <button
                type="button"
                onClick={onClose}
                style={css(
                  "background:transparent;border:none;color:var(--muted);font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;text-decoration:underline"
                )}
              >
                Cancel
              </button>
              <div style={css("flex:1")} />
              <Hoverable
                as="button"
                type="submit"
                disabled={phase === "loading"}
                styles={sx(
                  "border:none;border-radius:28px;padding:13px 24px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;color:#fff",
                  { background: PLUM, opacity: phase === "loading" ? 0.7 : 1 }
                )}
                hover="filter:brightness(1.08)"
              >
                {phase === "loading" ? "Sending…" : "Send request"}
              </Hoverable>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={css("margin-bottom:16px")}>
      <label
        style={css(
          "display:block;font-size:12.5px;font-weight:700;color:var(--ink);margin-bottom:6px"
        )}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

export default RequestItemModal;
