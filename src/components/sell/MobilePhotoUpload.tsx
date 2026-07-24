"use client";

import { useEffect, useRef, useState } from "react";
import { css, sx, Hoverable } from "@/lib/design/css";

/**
 * Phone-side of the "text me a code to add photos" flow. Loads at
 * /add-photos/{code}, validates the code, lets the seller take/pick photos, and
 * ships them to the open PhotoSession. The desktop create-listing form polls the
 * session and pulls them in. Fully self-contained and mobile-first.
 */

const MAX = 12;
const PLUM = "#630E3D";

type Gate = "checking" | "ready" | "invalid" | "expired" | "done";

interface Pic {
  url: string; // data:image/…
  id: string;
}

export function MobilePhotoUpload({ code }: { code: string }) {
  const cleanCode = (code || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const [gate, setGate] = useState<Gate>("checking");
  const [already, setAlready] = useState(0);
  const [pics, setPics] = useState<Pic[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentCount, setSentCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const idRef = useRef(0);

  // Validate the code on load.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!cleanCode) { setGate("invalid"); return; }
      try {
        const res = await fetch(`/api/sell/photo-session/upload?code=${encodeURIComponent(cleanCode)}`);
        const data = (await res.json()) as { valid?: boolean; reason?: string; count?: number };
        if (!alive) return;
        setAlready(data.count ?? 0);
        if (data.valid) setGate("ready");
        else setGate(data.reason === "expired" ? "expired" : "invalid");
      } catch {
        if (alive) setGate("invalid");
      }
    })();
    return () => { alive = false; };
  }, [cleanCode]);

  function onPick(files: FileList | null) {
    if (!files) return;
    const room = MAX - pics.length;
    Array.from(files).slice(0, Math.max(0, room)).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        const url = String(reader.result || "");
        if (!url.startsWith("data:image/")) return;
        setPics((p) => (p.length >= MAX ? p : [...p, { url, id: `p${idRef.current++}` }]));
      };
      reader.readAsDataURL(file);
    });
  }

  async function send() {
    if (busy || pics.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sell/photo-session/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: cleanCode, photos: pics.map((p) => p.url) }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; count?: number };
      if (!res.ok || !data.ok) {
        if (res.status === 410) { setGate("expired"); return; }
        setError(data.error || "Could not send your photos. Please try again.");
        return;
      }
      setSentCount(data.count ?? pics.length);
      setPics([]);
      setGate("done");
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  const shell = "position:fixed;inset:0;overflow-y:auto;background:var(--bg,#FBF7F1);font-family:var(--font-inter-tight),system-ui,sans-serif;color:#171717;-webkit-text-size-adjust:100%";
  const pad = "max-width:520px;margin:0 auto;padding:26px 20px 40px";

  /* ---- status screens ---- */
  if (gate === "checking") {
    return (
      <div style={css(shell)}><div style={css(pad + ";text-align:center;padding-top:80px")}>
        <div style={css("font-size:15px;color:#6b6b6b")}>Loading…</div>
      </div></div>
    );
  }

  if (gate === "invalid" || gate === "expired") {
    return (
      <div style={css(shell)}><div style={css(pad + ";text-align:center;padding-top:64px")}>
        <div style={css("width:60px;height:60px;margin:0 auto 18px;border-radius:50%;background:#FBEAE7;display:flex;align-items:center;justify-content:center")}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#c0392b" strokeWidth={2.4} strokeLinecap="round"><path d="M12 8v5M12 16.5v.5" /><circle cx="12" cy="12" r="9" /></svg>
        </div>
        <h1 style={css("font-family:var(--font-newsreader),serif;font-size:24px;font-weight:600;margin:0 0 8px")}>
          {gate === "expired" ? "This link expired" : "Link not found"}
        </h1>
        <p style={css("font-size:15px;color:#6b6b6b;line-height:1.5")}>
          {gate === "expired"
            ? "Photo links are good for 30 minutes. Head back to your computer and tap “Add photos from my phone” again for a fresh code."
            : "Double-check the code, or go back to your computer and start a new photo link."}
        </p>
      </div></div>
    );
  }

  if (gate === "done") {
    return (
      <div style={css(shell)}><div style={css(pad + ";text-align:center;padding-top:64px")}>
        <div style={css("width:64px;height:64px;margin:0 auto 18px;border-radius:50%;background:#E4F3E9;display:flex;align-items:center;justify-content:center")}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#1f8a4c" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </div>
        <h1 style={css("font-family:var(--font-newsreader),serif;font-size:26px;font-weight:600;margin:0 0 8px")}>Photos sent ✓</h1>
        <p style={css("font-size:15px;color:#6b6b6b;line-height:1.5;margin-bottom:26px")}>
          {sentCount} photo{sentCount === 1 ? "" : "s"} added to your listing. They’ll appear on your computer in a few seconds — you can head back there to finish.
        </p>
        <Hoverable as="button" onClick={() => { setGate("ready"); setSentCount(0); }} styles="background:#fff;border:1px solid #e4d8cc;border-radius:26px;padding:12px 24px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit;color:#171717" hover="border-color:#d9b7c2">Add more photos</Hoverable>
      </div></div>
    );
  }

  /* ---- ready: capture screen ---- */
  return (
    <div style={css(shell)}>
      <div style={css(pad)}>
        <div style={css("text-align:center;margin-bottom:22px")}>
          <h1 style={css("font-family:var(--font-newsreader),serif;font-size:26px;font-weight:600;margin:0 0 6px")}>Add your listing photos</h1>
          <p style={css("font-size:14.5px;color:#6b6b6b;line-height:1.5")}>
            Take clear photos of your item. They’ll flow straight to the listing you started on your computer.
            {already > 0 && <> You’ve already added {already}.</>}
          </p>
        </div>

        <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple
          onChange={(e) => { onPick(e.target.files); e.currentTarget.value = ""; }} style={css("display:none")} />

        {/* Big camera button */}
        <Hoverable as="button" onClick={() => fileRef.current?.click()}
          styles={`width:100%;border:2px dashed #d9c3b3;border-radius:18px;background:#fff;color:${PLUM};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;cursor:pointer;font-family:inherit;font-size:15px;font-weight:700;padding:30px 16px`}
          hover="border-color:#630E3D;background:#fdf6f0">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
          {pics.length === 0 ? "Take or choose photos" : "Add more"}
        </Hoverable>

        {/* Thumbnails */}
        {pics.length > 0 && (
          <div style={css("display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:18px")}>
            {pics.map((p) => (
              <div key={p.id} style={css("position:relative;aspect-ratio:1;border-radius:12px;overflow:hidden;border:1px solid #e8ddd0")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" style={css("width:100%;height:100%;object-fit:cover")} />
                <button type="button" onClick={() => setPics((prev) => prev.filter((x) => x.id !== p.id))} aria-label="Remove"
                  style={css("position:absolute;top:4px;right:4px;width:24px;height:24px;border:none;border-radius:50%;background:rgba(0,0,0,.62);color:#fff;font-size:15px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center")}>×</button>
              </div>
            ))}
          </div>
        )}

        {error && <div style={css("margin-top:16px;font-size:14px;color:#c0392b;text-align:center")}>{error}</div>}

        {/* Sticky send bar */}
        {pics.length > 0 && (
          <div style={css("position:sticky;bottom:0;margin:22px -20px 0;padding:14px 20px calc(14px + env(safe-area-inset-bottom));background:linear-gradient(to top,rgba(251,247,241,1) 60%,rgba(251,247,241,0))")}>
            <Hoverable as="button" onClick={send} disabled={busy}
              styles={sx(`width:100%;border:none;border-radius:30px;padding:15px;font-size:16px;font-weight:700;cursor:pointer;font-family:inherit;color:#fff;background:${PLUM}`, busy ? "opacity:.6;cursor:default" : "")}
              hover={busy ? "" : "filter:brightness(1.08)"}>
              {busy ? "Sending…" : `Send ${pics.length} photo${pics.length === 1 ? "" : "s"} to my listing`}
            </Hoverable>
          </div>
        )}

        <p style={css("margin-top:22px;text-align:center;font-size:12.5px;color:#9a9a9a")}>Code {cleanCode} · expires 30 min after it was created</p>
      </div>
    </div>
  );
}

export default MobilePhotoUpload;
