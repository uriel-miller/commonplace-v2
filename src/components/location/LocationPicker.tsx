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
    if (cityStr) onCityRef.current(cityStr);
    placeAt(lat, lng);
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

        // Places Autocomplete on the city input.
        const el = inputRef.current;
        const AC = g.places?.Autocomplete;
        if (el && AC) {
          const ac = new AC(el, {
            types: ["(cities)"],
            componentRestrictions: { country: "us" },
            fields: ["name", "formatted_address", "address_components", "geometry"],
          });
          ac.addListener("place_changed", () => {
            const place = ac.getPlace();
            const loc = place.geometry?.location;
            if (!loc) return;
            const cityStr =
              cityFromComponents(place.address_components) || place.name || place.formatted_address || el.value;
            commit(loc.lat(), loc.lng(), cityStr);
          });
        }

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

  const confirm = () => {
    const s = selRef.current;
    onConfirmRef.current({ city: city.trim() || s.city, lat: s.lat, lng: s.lng });
  };

  const shipNote =
    MAX == null
      ? `Free delivery within ${FREE} miles · ships anywhere`
      : `Free delivery within ${FREE} miles · ships up to ${MAX.toLocaleString("en-US")} mi`;

  return (
    <div>
      {/* City input (Autocomplete attaches here when the map is ready). */}
      <div style={sx(INPUT_WRAP, focused && "border-color:#d9b7c2")}>
        <Pin size={18} stroke="var(--maroon)" />
        <input
          ref={inputRef}
          value={city}
          onChange={(e) => onCity(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
          placeholder="City, state"
          aria-label="Delivery city"
          autoComplete="off"
          style={css(INPUT_FIELD)}
        />
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
