"use client";

import { useState } from "react";
import { css, sx } from "@/lib/design/css";

export function AdminLogin() {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        window.location.href = "/admin";
        return;
      }
      const body = await res.json().catch(() => ({}));
      setError(body?.error === "admin_not_configured" ? "Admin isn't configured (set ADMIN_TOKEN)." : "Invalid token.");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={css("min-height:100dvh;display:flex;align-items:center;justify-content:center;background:var(--cream);padding:24px")}>
      <form onSubmit={submit} style={css("width:380px;max-width:92vw;background:var(--paper);border:1px solid var(--line);border-radius:16px;box-shadow:0 24px 60px rgba(60,10,35,.12);padding:28px")}>
        <div style={css("font-family:'Reckless','Newsreader',serif;font-size:24px;font-weight:600;color:var(--maroon)")}>Commonplace Admin</div>
        <p style={css("font-size:13px;color:var(--muted);margin:4px 0 18px")}>Enter your admin token to continue.</p>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Admin token"
          autoFocus
          style={css("width:100%;border:1px solid var(--line);background:var(--cream);border-radius:10px;padding:12px 14px;font-size:14px;color:var(--ink);outline:none")}
        />
        {error && <div style={css("color:var(--red);font-size:12.5px;margin-top:8px")}>{error}</div>}
        <button
          type="submit"
          disabled={busy || !token}
          style={sx("width:100%;margin-top:16px;border:none;border-radius:10px;padding:13px;font-size:15px;font-weight:700;color:#fff;font-family:inherit;cursor:pointer", { background: busy || !token ? "var(--maroon2)" : "var(--maroon)", opacity: busy || !token ? 0.7 : 1 })}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <a href="/" style={css("display:block;text-align:center;margin-top:14px;font-size:12.5px;color:var(--blueInk);font-weight:600")}>← Back to site</a>
      </form>
    </div>
  );
}
