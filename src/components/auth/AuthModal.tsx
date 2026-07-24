"use client";

import { useState, useRef, useEffect } from "react";
import { css, sx, Hoverable } from "@/lib/design/css";

/**
 * Phone-number + one-time-code sign-up / log-in modal — matches how the live
 * Commonplace marketplace authenticates (phone → texted 6-digit code).
 *
 * Two-step state machine ("phone" → "code"), backed by the real /api/auth/otp
 * endpoint (texted code via Quo, hashed at rest, httpOnly session cookie on
 * verify). Wrong codes surface a real error. When SMS isn't wired (staging /
 * dev) the server returns a devCode so the flow stays testable. On-brand card.
 */

const PLUM = "#630E3D";

/** Keep only digits, cap at 10 (US number). */
function digitsOnly(v: string): string {
  try {
    return (v || "").replace(/\D+/g, "").slice(0, 10);
  } catch {
    return "";
  }
}

/** Format raw digits as (xxx) xxx-xxxx progressively. */
function formatPhone(raw: string): string {
  try {
    const d = digitsOnly(raw);
    if (d.length === 0) return "";
    if (d.length < 4) return `(${d}`;
    if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  } catch {
    return raw || "";
  }
}

/** Masked "Sent to (555) •••-4567" style label. */
function maskPhone(raw: string): string {
  try {
    const d = digitsOnly(raw);
    if (d.length < 10) return formatPhone(raw);
    return `(${d.slice(0, 3)}) •••-${d.slice(6)}`;
  } catch {
    return formatPhone(raw);
  }
}

export function AuthModal({
  open,
  onClose,
  onAuthed,
}: {
  open: boolean;
  onClose: () => void;
  onAuthed: (phone: string) => void;
}) {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState(""); // raw digits
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resent, setResent] = useState(false);
  // Prefilled in non-production when SMS isn't wired, so staging is testable.
  const [devCode, setDevCode] = useState("");

  const phoneRef = useRef<HTMLInputElement | null>(null);
  const codeRef = useRef<HTMLInputElement | null>(null);

  // Reset to a clean phone step every time the modal opens.
  useEffect(() => {
    if (open) {
      setStep("phone");
      setPhone("");
      setCode("");
      setLoading(false);
      setError("");
      setResent(false);
      setDevCode("");
    }
  }, [open]);

  // Auto-focus the active input on step change.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      try {
        if (step === "phone") phoneRef.current?.focus();
        else codeRef.current?.focus();
      } catch {
        /* focus is best-effort */
      }
    }, 60);
    return () => clearTimeout(t);
  }, [step, open]);

  // Escape closes the modal.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        try { onClose(); } catch { /* ignore */ }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function sendCode(): Promise<{ ok: boolean; error?: string; devCode?: string }> {
    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", phone: digitsOnly(phone) }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; devCode?: string };
      return { ok: res.ok && !!data.ok, error: data.error, devCode: data.devCode };
    } catch {
      return { ok: false, error: "Network error. Please try again." };
    }
  }

  async function handleSend() {
    setError("");
    if (digitsOnly(phone).length < 10) {
      setError("Please enter a valid 10-digit phone number.");
      return;
    }
    setLoading(true);
    const res = await sendCode();
    setLoading(false);
    if (!res.ok) {
      setError(res.error || "Could not send a code. Please try again.");
      return;
    }
    setCode(res.devCode ?? "");
    setDevCode(res.devCode ?? "");
    setStep("code");
  }

  async function handleVerify() {
    setError("");
    if (digitsOnly(code).length < 6) {
      setError("Enter the 6-digit code we texted you.");
      return;
    }
    setLoading(true);
    let ok = false;
    let msg = "";
    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", phone: digitsOnly(phone), code: digitsOnly(code) }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      ok = res.ok && !!data.ok;
      msg = data.error || "";
    } catch {
      msg = "Network error. Please try again.";
    }
    setLoading(false);
    if (!ok) {
      setError(msg || "That code is not correct.");
      return;
    }
    try { onAuthed(phone); } catch { /* ignore */ }
    try { onClose(); } catch { /* ignore */ }
  }

  async function handleResend() {
    setError("");
    setResent(false);
    const res = await sendCode();
    if (!res.ok) { setError(res.error || "Could not resend. Please try again."); return; }
    if (res.devCode) { setCode(res.devCode); setDevCode(res.devCode); }
    setResent(true);
    try {
      setTimeout(() => setResent(false), 2600);
    } catch {
      /* ignore */
    }
  }

  const canSend = digitsOnly(phone).length === 10;
  const canVerify = digitsOnly(code).length === 6;

  const btnBase =
    "width:100%;height:60px;border:0;border-radius:14px;font-family:inherit;font-size:17px;font-weight:800;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:filter .14s,opacity .14s";

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          try { onClose(); } catch { /* ignore */ }
        }
      }}
      style={css(
        "position:fixed;inset:0;z-index:500;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(25,12,18,.72);animation:cmpAuthFade .18s ease-out",
      )}
    >
      <style>
        {"@keyframes cmpAuthFade{from{opacity:0}to{opacity:1}}@keyframes cmpAuthScale{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}"}
      </style>

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sign in or sign up"
        style={css(
          "position:relative;width:100%;max-width:452px;background:var(--paper);border-radius:24px;box-shadow:0 30px 80px rgba(0,0,0,.35);animation:cmpAuthScale .2s cubic-bezier(.16,1,.3,1)",
        )}
      >
        {/* Round × close */}
        <button
          type="button"
          aria-label="Close"
          onClick={() => { try { onClose(); } catch { /* ignore */ } }}
          style={css(
            "position:absolute;top:16px;right:16px;width:32px;height:32px;border:0;border-radius:50%;background:#F0EDE8;color:#555;cursor:pointer;font-size:16px;line-height:1;z-index:1",
          )}
        >
          ×
        </button>

        <div style={css("padding:40px 34px 32px")}>
          {/* Brand mark */}
          <div
            style={sx(
              "width:56px;height:56px;border-radius:15px;display:flex;align-items:center;justify-content:center;margin-bottom:22px",
              { background: PLUM },
            )}
          >
            <svg width="29" height="29" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5v-7Z" />
              <path d="M4 8.5 12 13l8-4.5" />
              <path d="M12 13v7" />
            </svg>
          </div>

          {step === "phone" ? (
            <>
              <h2 style={css("font-family:'Reckless','Newsreader',serif;font-size:30px;font-weight:600;color:var(--ink);margin-bottom:8px;letter-spacing:-.01em")}>
                Sign in or sign up
              </h2>
              <p style={css("font-size:15.5px;color:var(--muted);line-height:1.5;margin-bottom:26px")}>
                Enter your phone number and we&rsquo;ll text you a code.
              </p>

              <label style={css("display:block;font-size:13px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-bottom:9px")}>
                Phone number
              </label>
              <input
                ref={phoneRef}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="(555) 123-4567"
                value={formatPhone(phone)}
                onChange={(e) => {
                  setError("");
                  setPhone(digitsOnly(e.target.value));
                }}
                onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
                style={sx(
                  "width:100%;height:60px;padding:0 18px;border-radius:14px;font-family:inherit;font-size:18px;color:var(--ink);background:var(--paper);outline:none;transition:border-color .14s,box-shadow .14s",
                  error
                    ? { border: "1.5px solid var(--red)" }
                    : { border: "1.5px solid var(--line)" },
                )}
              />
              {error && (
                <div style={css("font-size:12.5px;color:var(--red);margin-top:7px")}>{error}</div>
              )}

              <div style={css("margin-top:18px")}>
                <Hoverable
                  as="button"
                  type="button"
                  onClick={handleSend}
                  disabled={loading}
                  styles={sx(btnBase, {
                    background: PLUM,
                    opacity: loading ? 0.7 : 1,
                    cursor: loading ? "default" : "pointer",
                  })}
                  hover={loading ? "" : "filter:brightness(1.1)"}
                >
                  {loading ? "Sending…" : "Send code"}
                </Hoverable>
              </div>

              <p style={css("font-size:12.5px;color:var(--muted);line-height:1.5;margin-top:18px;text-align:center")}>
                By continuing you agree to our Terms &amp; Privacy Policy.
              </p>
            </>
          ) : (
            <>
              <h2 style={css("font-family:'Reckless','Newsreader',serif;font-size:30px;font-weight:600;color:var(--ink);margin-bottom:8px;letter-spacing:-.01em")}>
                Enter your code
              </h2>
              <p style={css("font-size:15.5px;color:var(--muted);line-height:1.5;margin-bottom:26px")}>
                Sent to {maskPhone(phone)}
              </p>
              {devCode && (
                <div style={css("margin:-14px 0 22px;padding:8px 12px;border-radius:10px;background:var(--yellowBg);border:1px solid #ecd9a3;font-size:12.5px;color:#7a5a12")}>
                  Testing mode (SMS not wired): your code is <b>{devCode}</b>
                </div>
              )}

              <input
                ref={codeRef}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => {
                  setError("");
                  setResent(false);
                  try {
                    setCode((e.target.value || "").replace(/\D+/g, "").slice(0, 6));
                  } catch {
                    setCode("");
                  }
                }}
                onKeyDown={(e) => { if (e.key === "Enter") handleVerify(); }}
                style={sx(
                  "width:100%;height:64px;padding:0 16px;border-radius:12px;font-family:inherit;font-size:30px;font-weight:700;letter-spacing:.42em;text-align:center;color:var(--ink);background:var(--paper);outline:none;transition:border-color .14s",
                  error
                    ? { border: "1.5px solid var(--red)" }
                    : { border: "1.5px solid var(--line)" },
                )}
              />
              {error && (
                <div style={css("font-size:12.5px;color:var(--red);margin-top:7px;text-align:center")}>{error}</div>
              )}

              <div style={css("margin-top:18px")}>
                <Hoverable
                  as="button"
                  type="button"
                  onClick={handleVerify}
                  disabled={loading}
                  styles={sx(btnBase, {
                    background: PLUM,
                    opacity: loading ? 0.7 : 1,
                    cursor: loading ? "default" : "pointer",
                  })}
                  hover={loading ? "" : "filter:brightness(1.1)"}
                >
                  {loading ? "Verifying…" : "Verify"}
                </Hoverable>
              </div>

              <div style={css("margin-top:18px;text-align:center;font-size:13px;color:var(--muted)")}>
                {resent ? (
                  <span style={sx("font-weight:700", { color: "var(--green)" })}>Code sent ✓</span>
                ) : (
                  <>
                    Didn&rsquo;t get it?{" "}
                    <Hoverable
                      as="button"
                      type="button"
                      onClick={handleResend}
                      styles={sx("border:0;background:none;padding:0;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;text-decoration:underline", { color: PLUM })}
                      hover="filter:brightness(1.2)"
                    >
                      Resend code
                    </Hoverable>
                  </>
                )}
              </div>

              <div style={css("margin-top:12px;text-align:center")}>
                <Hoverable
                  as="button"
                  type="button"
                  onClick={() => {
                    setError("");
                    setResent(false);
                    setCode("");
                    setStep("phone");
                  }}
                  styles={css("border:0;background:none;padding:6px;font-family:inherit;font-size:13px;color:var(--muted);cursor:pointer")}
                  hover="color:var(--ink)"
                >
                  ← Use a different number
                </Hoverable>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default AuthModal;
