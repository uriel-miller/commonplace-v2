"use client";

import { useEffect, useRef, useState } from "react";
import { css, sx } from "@/lib/design/css";
import { Pin } from "@/components/marketplace/icons";

/* ---------------------------------------------------------------------------
   Address input with autocomplete, backed by our own /api/places/autocomplete
   route (server-proxied Google Places). This avoids the Maps JS widget's
   referrer-allowlist and "Maps JavaScript API not enabled" failure modes — the
   route only needs the Places web service, which the working key already has.

   - Debounced lookups as the user types (3+ chars).
   - A styled suggestions dropdown matching the rest of the app.
   - Keyboard: ↑/↓ to move, Enter to pick, Esc to close.
   - If the route returns nothing (no key, offline), it degrades to a plain
     controlled text input — never crashes.
--------------------------------------------------------------------------- */

export interface AddressSelection {
  formatted: string;
  lat: number | null;
  lng: number | null;
  placeId: string | null;
}

interface Prediction {
  description: string;
  placeId: string;
}

export interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (selection: AddressSelection) => void;
  placeholder?: string;
}

const INPUT_WRAP =
  "display:flex;align-items:center;gap:10px;background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:12px 14px;transition:border-color .15s ease";
const INPUT_FIELD =
  "flex:1;border:none;outline:none;font-size:15px;font-weight:500;color:var(--ink);background:transparent";

export function AddressAutocomplete({ value, onChange, onSelect, placeholder }: AddressAutocompleteProps) {
  const [focused, setFocused] = useState(false);
  const [preds, setPreds] = useState<Prediction[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [locating, setLocating] = useState(false);
  const [locErr, setLocErr] = useState<string | null>(null);
  const justPicked = useRef(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // "Locate me" — browser geolocation → server reverse-geocode → fill address.
  function locateMe() {
    setLocErr(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocErr("Location isn't available on this device.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const r = await fetch(`/api/places/reverse?lat=${latitude}&lng=${longitude}`);
          const j = (await r.json()) as { address?: string | null };
          if (j.address) {
            justPicked.current = true;
            onChange(j.address);
            onSelect({ formatted: j.address, lat: latitude, lng: longitude, placeId: null });
            setOpen(false);
            setPreds([]);
          } else {
            setLocErr("Couldn't find your address — type it in.");
          }
        } catch {
          setLocErr("Couldn't fetch your address — type it in.");
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        setLocErr(err.code === err.PERMISSION_DENIED ? "Location permission denied — type it in." : "Couldn't get your location — type it in.");
      },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 60000 },
    );
  }

  // Debounced autocomplete lookup whenever the typed value changes.
  useEffect(() => {
    if (justPicked.current) { justPicked.current = false; return; }
    const q = value.trim();
    if (q.length < 3) { setPreds([]); setOpen(false); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const j = (await r.json()) as { predictions?: Prediction[] };
        const list = Array.isArray(j.predictions) ? j.predictions : [];
        setPreds(list);
        setActive(-1);
        setOpen(list.length > 0);
      } catch {
        /* aborted or offline — leave as plain input */
      }
    }, 220);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [value]);

  function pick(p: Prediction) {
    justPicked.current = true;
    onChange(p.description);
    onSelect({ formatted: p.description, lat: null, lng: null, placeId: p.placeId || null });
    setOpen(false);
    setPreds([]);
    setActive(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || preds.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (i + 1) % preds.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i <= 0 ? preds.length - 1 : i - 1)); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); pick(preds[active]); }
    else if (e.key === "Escape") { setOpen(false); }
  }

  return (
    <div style={css("position:relative")}>
      <div style={sx(INPUT_WRAP, focused && "border:1px solid #d9b7c2")}>
        <Pin size={18} stroke="var(--maroon)" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => { setFocused(true); if (preds.length) setOpen(true); }}
          onBlur={() => { setFocused(false); blurTimer.current = setTimeout(() => setOpen(false), 160); }}
          onKeyDown={onKeyDown}
          placeholder={placeholder ?? "Pickup address"}
          autoComplete="off"
          aria-label="Pickup address"
          aria-autocomplete="list"
          aria-expanded={open}
          style={css(INPUT_FIELD)}
        />
        <button
          type="button"
          onClick={locateMe}
          disabled={locating}
          aria-label="Use my current location"
          title="Use my current location"
          style={css(`display:inline-flex;align-items:center;gap:5px;flex:0 0 auto;background:var(--putty);border:1px solid var(--line);border-radius:9px;padding:6px 10px;font-size:12px;font-weight:700;color:var(--maroon);cursor:${locating ? "default" : "pointer"};font-family:inherit;white-space:nowrap;opacity:${locating ? ".65" : "1"}`)}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>
          {locating ? "Locating…" : "Locate me"}
        </button>
      </div>
      {locErr && <div style={css("font-size:11.5px;color:var(--red);margin-top:6px")}>{locErr}</div>}
      {open && preds.length > 0 && (
        <div style={css("position:absolute;top:calc(100% + 6px);left:0;right:0;background:var(--paper);border:1px solid var(--line);border-radius:12px;box-shadow:0 16px 40px rgba(60,10,35,.16);padding:5px;z-index:60;overflow:hidden")}>
          {preds.map((p, i) => (
            <div
              key={p.placeId || p.description}
              onMouseDown={(e) => { e.preventDefault(); if (blurTimer.current) clearTimeout(blurTimer.current); pick(p); }}
              onMouseEnter={() => setActive(i)}
              style={sx("display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:8px;cursor:pointer;font-size:13.5px;color:var(--ink)", i === active && "background:var(--putty)")}
            >
              <Pin size={15} stroke="var(--muted)" />
              <span style={css("flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{p.description}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
