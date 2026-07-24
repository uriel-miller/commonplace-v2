// Server-proxied Google reverse geocoding for the "Locate me" button. Takes a
// browser geolocation lat/lng and returns the nearest formatted street address.
// Keeps the key server-side. NEVER throws — failure degrades to {address:null}.

export const dynamic = "force-dynamic";
export const revalidate = 0;

const KEY = process.env.GOOGLE_MAPS_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || "";

export async function GET(req: Request): Promise<Response> {
  try {
    const params = new URL(req.url).searchParams;
    const lat = Number(params.get("lat"));
    const lng = Number(params.get("lng"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !KEY) {
      return Response.json({ address: null });
    }

    const url =
      "https://maps.googleapis.com/maps/api/geocode/json" +
      `?latlng=${encodeURIComponent(`${lat},${lng}`)}` +
      "&result_type=street_address|premise|subpremise|route" +
      `&key=${KEY}`;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(url, { cache: "no-store", signal: ctrl.signal }).finally(() => clearTimeout(timer));
    const j = (await r.json()) as { results?: Array<{ formatted_address?: string }> };

    const address = Array.isArray(j.results) && j.results[0]?.formatted_address ? j.results[0].formatted_address : null;
    return Response.json({ address });
  } catch {
    return Response.json({ address: null });
  }
}
