"use client";

import { useEffect, useRef, useState } from "react";
import { css, sx } from "@/lib/design/css";
import { Pin } from "@/components/marketplace/icons";

/* ---------------------------------------------------------------------------
   Pickup-address input backed by the Google Maps JavaScript Places API.

   - Dynamically injects the Maps JS script (key from NEXT_PUBLIC_GOOGLE_MAPS_KEY).
   - Attaches a google.maps.places.Autocomplete to the input.
   - On selection, reports { formatted, lat, lng, placeId } via onSelect.
   - If the key is absent or the script fails to load, it degrades to a plain
     controlled text input (no crash, no thrown errors).

   Narrow, dependency-free typings for the slice of the Maps API we touch.
--------------------------------------------------------------------------- */

export interface AddressSelection {
  formatted: string;
  lat: number | null;
  lng: number | null;
  placeId: string | null;
}

interface MapsLatLng {
  lat(): number;
  lng(): number;
}
interface MapsPlaceResult {
  formatted_address?: string;
  place_id?: string;
  geometry?: { location?: MapsLatLng };
}
interface MapsAutocomplete {
  addListener(event: string, handler: () => void): void;
  getPlace(): MapsPlaceResult;
  setFields(fields: string[]): void;
}
interface MapsAutocompleteCtor {
  new (input: HTMLInputElement, opts?: Record<string, unknown>): MapsAutocomplete;
}
interface MapsNamespace {
  maps?: { places?: { Autocomplete?: MapsAutocompleteCtor } };
}

type MapsWindow = Window & { google?: MapsNamespace };

const SCRIPT_ID = "gmaps-places-js";
let loaderPromise: Promise<boolean> | null = null;

/** Load the Maps JS once; resolves true if `google.maps.places` is available. */
function loadMapsScript(key: string): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  const w = window as MapsWindow;
  if (w.google?.maps?.places?.Autocomplete) return Promise.resolve(true);
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise<boolean>((resolve) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const ready = () => resolve(!!(window as MapsWindow).google?.maps?.places?.Autocomplete);
    if (existing) {
      existing.addEventListener("load", ready);
      existing.addEventListener("error", () => resolve(false));
      // If it already loaded before this listener attached.
      if ((window as MapsWindow).google?.maps?.places?.Autocomplete) resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places`;
    script.addEventListener("load", ready);
    script.addEventListener("error", () => resolve(false));
    document.head.appendChild(script);
  });
  return loaderPromise;
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
  const inputRef = useRef<HTMLInputElement>(null);
  const onSelectRef = useRef(onSelect);
  const onChangeRef = useRef(onChange);
  const [focused, setFocused] = useState(false);
  const [enhanced, setEnhanced] = useState(false);

  // Keep the latest callbacks without re-running the attach effect.
  useEffect(() => {
    onSelectRef.current = onSelect;
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    if (!key) return; // Graceful degradation: plain text input.

    let cancelled = false;
    loadMapsScript(key).then((ok) => {
      if (cancelled || !ok) return;
      const el = inputRef.current;
      const Ctor = (window as MapsWindow).google?.maps?.places?.Autocomplete;
      if (!el || !Ctor) return;

      const ac = new Ctor(el, {
        types: ["address"],
        fields: ["formatted_address", "geometry", "place_id"],
      });
      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        const loc = place.geometry?.location;
        const formatted = place.formatted_address ?? el.value;
        onChangeRef.current(formatted);
        onSelectRef.current({
          formatted,
          lat: loc ? loc.lat() : null,
          lng: loc ? loc.lng() : null,
          placeId: place.place_id ?? null,
        });
      });
      if (!cancelled) setEnhanced(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={sx(INPUT_WRAP, focused && "border-color:#d9b7c2")}>
      <Pin size={18} stroke="var(--maroon)" />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder ?? "Pickup address"}
        autoComplete={enhanced ? "off" : "street-address"}
        aria-label="Pickup address"
        style={css(INPUT_FIELD)}
      />
    </div>
  );
}
