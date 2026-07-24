// Server-proxied Google Places Autocomplete. Keeps the key server-side and
// avoids the JS-widget's referrer-allowlist / "Maps JavaScript API" pitfalls —
// the client just hits this route and renders our own styled dropdown.
//
// NEVER throws: any failure (missing key, upstream error, bad input) degrades to
// an empty prediction list so the address field stays a plain text input.

export const dynamic = "force-dynamic";
export const revalidate = 0;

const KEY = process.env.GOOGLE_MAPS_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || "";

interface Prediction {
  description: string;
  placeId: string;
}

export async function GET(req: Request): Promise<Response> {
  try {
    const input = new URL(req.url).searchParams.get("input")?.trim() ?? "";
    if (input.length < 3 || !KEY) return Response.json({ predictions: [] as Prediction[] });

    const url =
      "https://maps.googleapis.com/maps/api/place/autocomplete/json" +
      `?input=${encodeURIComponent(input)}` +
      "&types=address&components=country:us" +
      `&key=${KEY}`;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(url, { cache: "no-store", signal: ctrl.signal }).finally(() => clearTimeout(timer));
    const j = (await r.json()) as { predictions?: Array<{ description?: string; place_id?: string }> };

    const predictions: Prediction[] = Array.isArray(j.predictions)
      ? j.predictions
          .slice(0, 6)
          .map((p) => ({ description: p.description ?? "", placeId: p.place_id ?? "" }))
          .filter((p) => p.description)
      : [];

    return Response.json({ predictions });
  } catch {
    return Response.json({ predictions: [] as Prediction[] });
  }
}
