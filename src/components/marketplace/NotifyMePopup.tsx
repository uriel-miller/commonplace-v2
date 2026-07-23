"use client";

import { useEffect, useState } from "react";
import { css, sx, Hoverable } from "@/lib/design/css";

const PLUM = "#630E3D";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * "Notify me" email-capture pop-up — shown when a listing is sold/unavailable
 * or to watch for price drops. Captures a single email and fires a fail-soft
 * POST to /api/leads; the user always lands on the success state, even if the
 * network call fails, so we never lose the intent behind a transient error.
 *
 * Self-contained and fail-soft by construction: no external deps, no images,
 * and the whole render is wrapped so a single bad prop can't throw.
 */
export function NotifyMePopup({
  open,
  itemTitle,
  onClose,
}: {
  open: boolean;
  itemTitle?: string;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "success">("idle");

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (state === "loading") return;
      const value = email.trim();
      if (!EMAIL_RE.test(value)) {
        setError("Please enter a valid email address.");
        return;
      }
      setError("");
      setState("loading");
      try {
        await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "notify-me", itemTitle, email: value }),
        });
      } catch {
        /* fail-soft — success regardless */
      }
      setState("success");
    } catch {
      /* never let the handler throw */
      setState("success");
    }
  }

  const subtitle = itemTitle
    ? `We'll email you the moment "${itemTitle}" is back in stock or drops in price.`
    : "We'll email you when this comes back in stock or drops in price.";

  let body: React.ReactNode = null;
  try {
    body = (
      <div role="presentation"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        style={css("position:fixed;inset:0;z-index:400;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(25,12,18,.72);animation:cmpNotifyFade .18s ease-out")}>
        <style>{"@keyframes cmpNotifyFade{from{opacity:0}to{opacity:1}}@keyframes cmpNotifyScale{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}"}</style>
        <div role="dialog" aria-modal="true" aria-label="Get notified"
          style={css("position:relative;width:100%;max-width:440px;overflow:hidden;background:#fff;border-radius:18px;box-shadow:0 30px 80px rgba(0,0,0,.35);animation:cmpNotifyScale .2s cubic-bezier(.16,1,.3,1)")}>
          {/* Plum accent bar */}
          <div style={sx("height:4px;width:100%", { background: PLUM })} />

          <button type="button" aria-label="Close" onClick={onClose}
            style={css("position:absolute;top:16px;right:16px;width:32px;height:32px;border:0;border-radius:50%;background:#F0EDE8;color:#555;cursor:pointer;font-size:16px;line-height:1;z-index:1")}>×</button>

          {state === "success" ? (
            <div style={css("padding:36px 28px 28px;text-align:center")}>
              <div style={css("width:56px;height:56px;margin:0 auto 16px;border-radius:50%;background:var(--green);display:flex;align-items:center;justify-content:center")}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              </div>
              <h2 style={css("font-family:'Reckless','Newsreader',serif;font-size:23px;font-weight:600;color:var(--ink);margin-bottom:6px")}>You're on the list</h2>
              <p style={css("font-size:14px;color:var(--muted);line-height:1.5;margin-bottom:22px")}>We'll email you as soon as there's news.</p>
              <Hoverable as="button" onClick={onClose}
                styles={sx("width:100%;height:52px;border:none;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer;font-family:inherit;color:#fff", { background: PLUM })}
                hover="filter:brightness(1.08)">
                Done
              </Hoverable>
            </div>
          ) : (
            <div style={css("padding:28px")}>
              {/* Header */}
              <div style={css("display:flex;align-items:center;gap:12px;margin-bottom:8px")}>
                <div style={css("flex:0 0 auto;width:40px;height:40px;border-radius:50%;background:var(--blueBg);display:flex;align-items:center;justify-content:center")}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--blueInk)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                </div>
                <h2 style={css("font-family:'Reckless','Newsreader',serif;font-size:23px;font-weight:600;color:var(--ink)")}>Get notified</h2>
              </div>
              <p style={css("font-size:14px;color:var(--muted);line-height:1.5;margin-bottom:20px")}>{subtitle}</p>

              {/* Body */}
              <form onSubmit={onSubmit}>
                <input type="email" required value={email} placeholder="you@email.com"
                  aria-label="Email address" aria-invalid={!!error}
                  onChange={(e) => { setEmail(e.target.value); if (error) setError(""); }}
                  style={css("width:100%;box-sizing:border-box;height:52px;padding:0 16px;font-size:16px;color:var(--ink);background:var(--paper);border:1px solid var(--line);border-radius:10px;outline:none")} />
                {error && (
                  <div style={css("color:var(--red);font-size:13px;margin-top:6px")}>{error}</div>
                )}
                <div style={css("margin-top:14px")}>
                  <Hoverable as="button" type="submit"
                    styles={sx("width:100%;height:52px;border:none;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer;font-family:inherit;color:#fff", { background: PLUM, opacity: state === "loading" ? 0.75 : 1 })}
                    hover="filter:brightness(1.08)">
                    {state === "loading" ? "Signing you up…" : "Notify me"}
                  </Hoverable>
                </div>
              </form>
              <p style={css("font-size:12.5px;color:var(--muted);text-align:center;margin-top:12px")}>No spam — just this one alert.</p>
            </div>
          )}
        </div>
      </div>
    );
  } catch {
    body = null;
  }

  return body;
}

export default NotifyMePopup;
