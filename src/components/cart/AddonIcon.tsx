import { css, sx } from "@/lib/design/css";

/**
 * Distinct, recognizable icon per add-on (no copyrighted product photos). Picks
 * the shape from the add-on's title/kind: shoe, seat, phone, weights, fan, mat,
 * key, desk, shield (warranty), clipboard (service), box (generic accessory).
 */
function pick(title: string, kind: string): React.ReactNode {
  const t = title.toLowerCase();
  const s = 22;
  const p = { width: s, height: s, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (kind === "warranty") return <svg {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>;
  if (kind === "service" || /inspect|check.?in|pre.?pickup|report/.test(t)) return <svg {...p}><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>;
  if (/shoe|cleat/.test(t)) return <svg {...p}><path d="M2 17h20a1 1 0 0 0 1-1c0-2-2-3-4-3l-4-3-3 2H6a4 4 0 0 0-4 4z" /><path d="M2 17v2h20v-2" /></svg>;
  if (/seat|cushion|saddle/.test(t)) return <svg {...p}><path d="M5 11V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4" /><path d="M4 11h16a1 1 0 0 1 1 1v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a1 1 0 0 1 1-1z" /><path d="M6 16v3M18 16v3" /></svg>;
  if (/phone|tablet|holder/.test(t)) return <svg {...p}><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></svg>;
  if (/weight|dumbbell|kettlebell/.test(t)) return <svg {...p}><path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11" /></svg>;
  if (/fan/.test(t)) return <svg {...p}><circle cx="12" cy="12" r="2" /><path d="M12 10c0-4 1-7 3-7s2 3-1 5M14 12c4 0 7 1 7 3s-3 2-5-1M12 14c0 4-1 7-3 7s-2-3 1-5M10 12c-4 0-7-1-7-3s3-2 5 1" /></svg>;
  if (/mat/.test(t)) return <svg {...p}><rect x="2" y="7" width="20" height="10" rx="1.5" /><path d="M5 7v10M8 7v10" /></svg>;
  if (/swivel|rotate/.test(t)) return <svg {...p}><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 3v5h-5" /></svg>;
  if (/key/.test(t)) return <svg {...p}><circle cx="7.5" cy="15.5" r="4.5" /><path d="M10.5 12.5 20 3M16 7l3 3M14 9l3 3" /></svg>;
  if (/desk|laptop/.test(t)) return <svg {...p}><rect x="2" y="4" width="20" height="12" rx="2" /><path d="M2 20h20" /></svg>;
  return <svg {...p}><path d="M20.6 8.4 12 3 3.4 8.4 12 13.8l8.6-5.4Z" /><path d="M3.4 8.4V15.6L12 21l8.6-5.4V8.4" /><path d="M12 13.8V21" /></svg>;
}

export function AddonIcon({ title, kind, size = 48, image }: { title: string; kind: string; size?: number; image?: string }) {
  const tile =
    kind === "warranty" ? { background: "var(--tint)", color: "var(--maroon)" }
    : kind === "service" ? { background: "var(--greenBg)", color: "var(--green)" }
    : { background: "var(--blueBg)", color: "var(--blueInk)" };
  // Real product photo when available (accessories + services); icon otherwise.
  if (image) {
    return (
      <img src={image} alt={title} loading="lazy" width={size} height={size}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        style={css(`width:${size}px;height:${size}px;flex:0 0 auto;border-radius:11px;object-fit:cover;background:var(--putty)`)} />
    );
  }
  return (
    <div style={sx(`width:${size}px;height:${size}px;flex:0 0 auto;border-radius:11px;display:flex;align-items:center;justify-content:center`, tile)}>
      {pick(title, kind)}
    </div>
  );
}
