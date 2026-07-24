"use client";

import { useEffect, useRef, useState } from "react";
import { css, sx } from "@/lib/design/css";
import { Pin } from "@/components/marketplace/icons";
import { shippingInfo } from "@/lib/listing";

/* ---------------------------------------------------------------------------
   LocationPicker — a REAL interactive Google Map "deliver-to" selector.

   - Loads the Google Maps JS API once (key from NEXT_PUBLIC_GOOGLE_MAPS_KEY,
     libraries=places), caching the loader promise across mounts/modules.
   - Places Autocomplete on a "City, state" (US) input → sets city + lat/lng
     and recenters the map.
   - "Use my current location" → geolocation → reverse-geocode to a city string
     → recenters, drops a marker.
   - Renders a google.maps.Map with a marker at the selection and a
     google.maps.Circle for the 100-mile FREE delivery radius (green, translucent).
   - Graceful degradation: if the key is missing OR the script fails to load
     (e.g. HTTP-referrer restriction), falls back to a plain text city input
     with a "Map unavailable" note. Nothing ever throws to the user.

   Narrow, dependency-free typings for the slice of the Maps API we touch —
   no `any`, no new npm dependency.
--------------------------------------------------------------------------- */

/* --------------------------- Narrow Maps typings --------------------------- */

interface MapsLatLng {
  lat(): number;
  lng(): number;
}
type MapsLatLngLiteral = { lat: number; lng: number };
type MapsLatLngBounds = object; // opaque — we only pass it back to fitBounds

interface MapsAddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}
interface MapsGeocoderResult {
  formatted_address?: string;
  address_components?: MapsAddressComponent[];
  geometry?: { location?: MapsLatLng };
}
interface MapsGeocoder {
  geocode(
    request: { location?: MapsLatLngLiteral; address?: string },
    callback: (results: MapsGeocoderResult[] | null, status: string) => void,
  ): void;
}
interface MapsGeocoderCtor {
  new (): MapsGeocoder;
}

interface MapsMap {
  setCenter(latLng: MapsLatLngLiteral): void;
  setZoom(zoom: number): void;
  fitBounds(bounds: MapsLatLngBounds, padding?: number): void;
}
interface MapsMapCtor {
  new (el: HTMLElement, opts?: Record<string, unknown>): MapsMap;
}

interface MapsMarker {
  setPosition(latLng: MapsLatLngLiteral): void;
  setMap(map: MapsMap | null): void;
}
interface MapsMarkerCtor {
  new (opts: Record<string, unknown>): MapsMarker;
}

interface MapsCircle {
  setCenter(latLng: MapsLatLngLiteral): void;
  setRadius(meters: number): void;
  setMap(map: MapsMap | null): void;
  getBounds(): MapsLatLngBounds | null;
}
interface MapsCircleCtor {
  new (opts: Record<string, unknown>): MapsCircle;
}

interface MapsPlaceResult {
  name?: string;
  formatted_address?: string;
  address_components?: MapsAddressComponent[];
  geometry?: { location?: MapsLatLng };
}
interface MapsAutocomplete {
  addListener(event: string, handler: () => void): void;
  getPlace(): MapsPlaceResult;
}
interface MapsAutocompleteCtor {
  new (input: HTMLInputElement, opts?: Record<string, unknown>): MapsAutocomplete;
}

interface MapsNamespace {
  maps?: {
    Map?: MapsMapCtor;
    Marker?: MapsMarkerCtor;
    Circle?: MapsCircleCtor;
    Geocoder?: MapsGeocoderCtor;
    places?: { Autocomplete?: MapsAutocompleteCtor };
  };
}
type MapsWindow = Window & { google?: MapsNamespace };

/* ------------------------------ Script loader ------------------------------ */
// Reuse the same id the sell-side loader uses so a second <script> is never
// injected when both mount on one page.
const SCRIPT_ID = "gmaps-places-js";
let loaderPromise: Promise<boolean> | null = null;

function mapsReady(): boolean {
  if (typeof window === "undefined") return false;
  const m = (window as MapsWindow).google?.maps;
  return !!(m?.Map && m.places?.Autocomplete && m.Geocoder);
}

/** Load the Maps JS once; resolves true when the pieces we use are available. */
function loadMapsScript(key: string): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (mapsReady()) return Promise.resolve(true);
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise<boolean>((resolve) => {
    const finish = () => resolve(mapsReady());
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", finish);
      existing.addEventListener("error", () => resolve(false));
      if (mapsReady()) resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places`;
    script.addEventListener("load", finish);
    script.addEventListener("error", () => resolve(false));
    document.head.appendChild(script);
  }).catch(() => false);

  return loaderPromise;
}

/* --------------------------------- Helpers --------------------------------- */

const MILES_TO_M = 1609.34;
// Continental-US default center so the empty map isn't blank.
const US_CENTER: MapsLatLngLiteral = { lat: 39.5, lng: -98.35 };
const US_ZOOM = 4;
const GREEN = "#1E9E5A";

/** Build "City, ST" from geocoder/autocomplete address components. */
function cityFromComponents(components: MapsAddressComponent[] | undefined): string {
  if (!components) return "";
  const pick = (type: string) => components.find((c) => c.types.includes(type));
  const locality =
    pick("locality") ?? pick("postal_town") ?? pick("sublocality") ?? pick("administrative_area_level_2");
  const state = pick("administrative_area_level_1");
  const cityName = locality?.long_name ?? "";
  const stateAbbr = state?.short_name ?? "";
  if (cityName && stateAbbr) return `${cityName}, ${stateAbbr}`;
  return cityName || stateAbbr || "";
}

/* -------------------------------- Component -------------------------------- */

export interface LocationSelection {
  city: string;
  lat: number | null;
  lng: number | null;
}

export interface LocationPickerProps {
  city: string;
  onCity: (v: string) => void;
  onConfirm: (sel: LocationSelection) => void;
}

type MapStatus = "loading" | "ready" | "unavailable";

const FREE = shippingInfo(null).freeMi; // 100
const MAX = shippingInfo(null).maxMi; // 1500

const INPUT_WRAP =
  "display:flex;align-items:center;gap:10px;background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:12px 14px;transition:border-color .15s ease";
const INPUT_FIELD =
  "flex:1;border:none;outline:none;font-size:15px;font-weight:600;color:var(--ink);background:transparent";

export function LocationPicker({ city, onCity, onConfirm }: LocationPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const mapDivRef = useRef<HTMLDivElement>(null);

  const mapRef = useRef<MapsMap | null>(null);
  const markerRef = useRef<MapsMarker | null>(null);
  const circleRef = useRef<MapsCircle | null>(null);
  const geocoderRef = useRef<MapsGeocoder | null>(null);

  // Latest selection, kept in refs so the map-attach effect can stay [] and
  // callbacks don't force re-init.
  const selRef = useRef<LocationSelection>({ city, lat: null, lng: null });
  const onCityRef = useRef(onCity);
  const onConfirmRef = useRef(onConfirm);
  useEffect(() => {
    onCityRef.current = onCity;
    onConfirmRef.current = onConfirm;
  });

  const [status, setStatus] = useState<MapStatus>("loading");
  const [focused, setFocused] = useState(false);
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // Local input text — the committed "Deliver to" label only changes on Update,
  // never on every keystroke (that leaked partial/garbage values into the label).
  const [text, setText] = useState(city);
  // Custom autocomplete (server-proxied Places) — replaces Google's pac-container
  // widget, which rendered its dropdown on top of the input inside the modal.
  const [preds, setPreds] = useState<{ description: string; placeId: string }[]>([]);
  const [acOpen, setAcOpen] = useState(false);
  const [acActive, setAcActive] = useState(-1);
  const justPicked = useRef(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Draw/refresh the marker + free-delivery circle and frame them.
  const placeAt = (lat: number, lng: number) => {
    const g = (window as MapsWindow).google?.maps;
    const map = mapRef.current;
    if (!g || !map) return;
    const pos: MapsLatLngLiteral = { lat, lng };

    if (!markerRef.current && g.Marker) {
      markerRef.current = new g.Marker({ position: pos, map });
    } else if (markerRef.current) {
      markerRef.current.setPosition(pos);
      markerRef.current.setMap(map);
    }

    if (!circleRef.current && g.Circle) {
      circleRef.current = new g.Circle({
        center: pos,
        radius: FREE * MILES_TO_M,
        map,
        fillColor: GREEN,
        fillOpacity: 0.12,
        strokeColor: GREEN,
        strokeOpacity: 0.5,
        strokeWeight: 1,
        clickable: false,
      });
    } else if (circleRef.current) {
      circleRef.current.setCenter(pos);
      circleRef.current.setMap(map);
    }

    try {
      const bounds = circleRef.current?.getBounds();
      if (bounds) map.fitBounds(bounds, 24);
      else {
        map.setCenter(pos);
        map.setZoom(8);
      }
    } catch {
      map.setCenter(pos);
      map.setZoom(8);
    }
  };

  const commit = (lat: number, lng: number, cityStr: string) => {
    selRef.current = { city: cityStr, lat, lng };
    if (cityStr) setText(cityStr); // reflect in the input, but don't commit the label yet
    placeAt(lat, lng);
  };

  // Debounced server-proxied Places autocomplete as the user types.
  useEffect(() => {
    if (justPicked.current) { justPicked.current = false; return; }
    const q = text.trim();
    // A bare 5-digit ZIP: geocode it directly to "City, ST". Google's address
    // autocomplete otherwise reads "19004" as a house number and returns streets.
    if (/^\d{5}$/.test(q)) {
      const geocoder = geocoderRef.current;
      if (!geocoder) { setPreds([]); setAcOpen(false); return; }
      const t = setTimeout(() => {
        geocoder.geocode({ address: `${q}, USA` }, (results, gStatus) => {
          if (gStatus !== "OK" || !results || !results[0]) { setPreds([]); setAcOpen(false); return; }
          const loc = results[0].geometry?.location;
          const cityStr = cityFromComponents(results[0].address_components) || results[0].formatted_address || q;
          if (loc) { selRef.current = { city: cityStr, lat: loc.lat(), lng: loc.lng() }; placeAt(loc.lat(), loc.lng()); }
          setPreds([{ description: cityStr, placeId: "" }]); setAcActive(0); setAcOpen(true);
        });
      }, 250);
      return () => clearTimeout(t);
    }
    if (q.length < 3) { setPreds([]); setAcOpen(false); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const j = (await r.json()) as { predictions?: { description: string; placeId: string }[] };
        const list = Array.isArray(j.predictions) ? j.predictions : [];
        setPreds(list); setAcActive(-1); setAcOpen(list.length > 0);
      } catch { /* aborted / offline — stay a plain input */ }
    }, 220);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [text]);

  // Pick a suggestion: fill the field, geocode it, recenter the map.
  const pickPrediction = (p: { description: string; placeId: string }) => {
    justPicked.current = true;
    setText(p.description);
    setAcOpen(false); setPreds([]); setAcActive(-1);
    selRef.current = { city: p.description, lat: selRef.current.lat, lng: selRef.current.lng };
    const geocoder = geocoderRef.current;
    if (geocoder) {
      geocoder.geocode({ address: p.description }, (results, gStatus) => {
        if (gStatus !== "OK" || !results || !results[0]) return;
        const loc = results[0].geometry?.location;
        const cityStr = cityFromComponents(results[0].address_components) || p.description;
        if (loc) { selRef.current = { city: cityStr, lat: loc.lat(), lng: loc.lng() }; setText(cityStr); placeAt(loc.lat(), loc.lng()); }
      });
    }
  };

  // One-time: load Maps, build the map + autocomplete + geocoder.
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    if (!key) {
      setStatus("unavailable");
      return;
    }

    let cancelled = false;
    loadMapsScript(key).then((ok) => {
      if (cancelled) return;
      const g = (window as MapsWindow).google?.maps;
      const div = mapDivRef.current;
      if (!ok || !g?.Map || !div) {
        setStatus("unavailable");
        return;
      }

      try {
        const map = new g.Map(div, {
          center: US_CENTER,
          zoom: US_ZOOM,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "cooperative",
          clickableIcons: false,
        });
        mapRef.current = map;
        if (g.Geocoder) geocoderRef.current = new g.Geocoder();

        // Autocomplete uses our /api/places route + a custom dropdown (below),
        // so no Google pac-container is attached to the input.

        setStatus("ready");

        // If we already have a city string, try to center on it.
        const initial = selRef.current.city.trim();
        if (initial && geocoderRef.current) {
          geocoderRef.current.geocode({ address: initial }, (results, gStatus) => {
            if (cancelled || gStatus !== "OK" || !results || !results[0]) return;
            const loc = results[0].geometry?.location;
            if (loc) placeAt(loc.lat(), loc.lng());
          });
        }
      } catch {
        setStatus("unavailable");
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const useMyLocation = () => {
    setNote(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setNote("Location isn't available on this device.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const geocoder = geocoderRef.current;
        if (geocoder) {
          geocoder.geocode({ location: { lat, lng } }, (results, gStatus) => {
            const cityStr =
              gStatus === "OK" && results && results[0]
                ? cityFromComponents(results[0].address_components) || results[0].formatted_address || ""
                : "";
            commit(lat, lng, cityStr);
            setLocating(false);
          });
        } else {
          // No geocoder (map unavailable): still drop coords, keep prior label.
          commit(lat, lng, selRef.current.city);
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        setNote("Couldn't get your location — enter your city instead.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };

  const commitFinal = (cityStr: string, lat: number | null, lng: number | null) => {
    onCityRef.current(cityStr);
    onConfirmRef.current({ city: cityStr, lat, lng });
  };

  const confirm = () => {
    const s = selRef.current;
    const raw = text.trim();
    // Already a "City, ST" (from autocomplete / typing) → commit as-is.
    const looksLikeCityState = /,\s*[A-Za-z]{2}\b/.test(raw);
    const geocoder = geocoderRef.current;
    if (raw && !looksLikeCityState && geocoder) {
      // A bare ZIP or city name — resolve it to "City, ST" before committing.
      geocoder.geocode({ address: raw }, (results, gStatus) => {
        if (gStatus === "OK" && results && results[0]) {
          const resolved = cityFromComponents(results[0].address_components) || results[0].formatted_address || raw;
          const loc = results[0].geometry?.location;
          commitFinal(resolved, loc ? loc.lat() : s.lat, loc ? loc.lng() : s.lng);
        } else {
          commitFinal(raw, s.lat, s.lng);
        }
      });
      return;
    }
    commitFinal(raw || s.city || city.trim(), s.lat, s.lng);
  };

  const shipNote =
    MAX == null
      ? `Free delivery within ${FREE} miles · ships anywhere`
      : `Free delivery within ${FREE} miles · ships up to ${MAX.toLocaleString("en-US")} mi`;

  return (
    <div>
      {/* City input with a custom suggestions dropdown (no Google pac-container). */}
      <div style={css("position:relative")}>
        <div style={sx(INPUT_WRAP, focused && "border:1px solid #d9b7c2")}>
          <Pin size={18} stroke="var(--maroon)" />
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => { setFocused(true); if (preds.length) setAcOpen(true); }}
            onBlur={() => { setFocused(false); blurTimer.current = setTimeout(() => setAcOpen(false), 160); }}
            onKeyDown={(e) => {
              if (acOpen && preds.length) {
                if (e.key === "ArrowDown") { e.preventDefault(); setAcActive((i) => (i + 1) % preds.length); return; }
                if (e.key === "ArrowUp") { e.preventDefault(); setAcActive((i) => (i <= 0 ? preds.length - 1 : i - 1)); return; }
                if (e.key === "Enter" && acActive >= 0) { e.preventDefault(); pickPrediction(preds[acActive]); return; }
                if (e.key === "Escape") { setAcOpen(false); return; }
              }
              // Enter commits the typed value (a ZIP is geocoded to "City, ST").
              if (e.key === "Enter") { e.preventDefault(); confirm(); }
            }}
            placeholder="City, state or ZIP"
            aria-label="Delivery city"
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={acOpen}
            style={css(INPUT_FIELD)}
          />
        </div>
        {acOpen && preds.length > 0 && (
          <div style={css("position:absolute;top:calc(100% + 6px);left:0;right:0;background:var(--paper);border:1px solid var(--line);border-radius:12px;box-shadow:0 16px 40px rgba(60,10,35,.16);padding:5px;z-index:80;overflow:hidden")}>
            {preds.map((p, i) => (
              <div
                key={p.placeId || p.description}
                onMouseDown={(e) => { e.preventDefault(); if (blurTimer.current) clearTimeout(blurTimer.current); pickPrediction(p); }}
                onMouseEnter={() => setAcActive(i)}
                style={sx("display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:8px;cursor:pointer;font-size:13.5px;color:var(--ink)", i === acActive && "background:var(--putty)")}
              >
                <Pin size={15} stroke="var(--muted)" />
                <span style={css("flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{p.description}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Use-my-location */}
      <button
        type="button"
        onClick={useMyLocation}
        disabled={locating}
        style={sx(
          "margin-top:10px;width:100%;display:flex;align-items:center;justify-content:center;gap:8px;background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:11px 14px;font-size:13.5px;font-weight:700;color:var(--maroon);cursor:pointer",
          locating && "opacity:.6;cursor:default",
        )}
      >
        <Pin size={15} stroke="var(--maroon)" />
        {locating ? "Locating…" : "Use my current location"}
      </button>

      {note && <div style={css("margin-top:8px;font-size:12px;color:var(--red)")}>{note}</div>}

      {/* Map (real) OR graceful-degradation note */}
      {status !== "unavailable" ? (
        <div style={css("margin-top:12px;position:relative;border-radius:14px;overflow:hidden;border:1px solid var(--line)")}>
          <div ref={mapDivRef} style={css("width:100%;height:220px;background:var(--putty)")} />
          {status === "loading" && (
            <div style={css("position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:var(--putty);color:var(--muted);font-size:13px")}>
              Loading map…
            </div>
          )}
        </div>
      ) : (
        <div style={css("margin-top:12px;border-radius:14px;border:1px dashed var(--line);background:var(--paper);padding:16px;text-align:center;color:var(--muted);font-size:13px")}>
          Map unavailable — enter your city
        </div>
      )}

      {/* Free-delivery legend */}
      <div style={css("margin-top:12px;display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--muted)")}>
        <span style={sx("width:12px;height:12px;border-radius:50%;flex:none", { background: "rgba(30,158,90,.18)", border: `1px solid ${GREEN}` })} />
        <span>{shipNote}</span>
      </div>

      {/* Confirm */}
      <div
        onClick={confirm}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") confirm();
        }}
        style={css("margin-top:16px;text-align:center;background:var(--maroon);color:#fff;border-radius:12px;padding:14px;font-size:15px;font-weight:700;cursor:pointer")}
      >
        Update
      </div>
    </div>
  );
}
