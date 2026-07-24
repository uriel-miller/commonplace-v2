"use client";

import { useCallback, useEffect, useState } from "react";
import { css, sx } from "@/lib/design/css";

/* Product-analytics dashboard — screens, most-viewed listings, click targets,
   the seller funnel (drop-off), and a live event feed. Reads /api/admin/analytics
   (admin-cookie authed). Fully fail-soft. */

interface Summary {
  windowHours: number;
  totals: { events: number; users: number; sessions: number };
  topScreens: { screen: string; views: number }[];
  topListings: { listingId: number; views: number }[];
  topClicks: { name: string; count: number }[];
  sellFunnel: { step: string; users: number }[];
  recent: { name: string; screen: string | null; path: string | null; anonId: string; ts: string }[];
}

const WINDOWS: [string, number][] = [["24h", 24], ["7 days", 168], ["30 days", 720]];
const CARD = "background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:16px 18px";
const num = (n: number) => n.toLocaleString("en-US");

export function AnalyticsAdmin() {
  const [hours, setHours] = useState(168);
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (h: number) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/analytics?hours=${h}`, { cache: "no-store" });
      setData((await r.json()) as Summary);
    } catch { setData(null); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(hours); }, [hours, load]);

  const funnelTop = data?.sellFunnel?.[0]?.users || 0;

  return (
    <div style={css("display:flex;flex-direction:column;gap:18px")}>
      {/* Window selector + refresh */}
      <div style={css("display:flex;align-items:center;gap:10px;flex-wrap:wrap")}>
        <div style={css("display:flex;gap:6px;background:var(--putty);border-radius:12px;padding:4px")}>
          {WINDOWS.map(([label, h]) => (
            <div key={h} onClick={() => setHours(h)} style={sx("padding:7px 14px;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;transition:all .14s", hours === h ? { background: "var(--paper)", color: "var(--maroon)", boxShadow: "0 1px 3px rgba(0,0,0,.1)" } : { color: "var(--muted)" })}>{label}</div>
          ))}
        </div>
        <button onClick={() => void load(hours)} style={css("margin-left:auto;background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:8px 14px;font-size:13px;font-weight:700;color:var(--ink);cursor:pointer;font-family:inherit")}>{loading ? "Loading…" : "Refresh"}</button>
      </div>

      {/* Totals */}
      <div style={css("display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px")}>
        {[["Events", data?.totals.events], ["Unique users", data?.totals.users], ["Sessions", data?.totals.sessions]].map(([label, val]) => (
          <div key={label as string} style={css(CARD)}>
            <div style={css("font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);margin-bottom:6px")}>{label as string}</div>
            <div style={css("font-size:30px;font-weight:800;color:var(--ink)")}>{num((val as number) ?? 0)}</div>
          </div>
        ))}
      </div>

      {/* Seller funnel */}
      <div style={css(CARD)}>
        <div style={css("font-size:15px;font-weight:800;margin-bottom:14px")}>Create-a-listing funnel <span style={css("font-size:12.5px;font-weight:500;color:var(--muted)")}>(where sellers drop off)</span></div>
        <div style={css("display:flex;flex-direction:column;gap:9px")}>
          {(data?.sellFunnel ?? []).map((s) => {
            const pct = funnelTop > 0 ? Math.round((s.users / funnelTop) * 100) : 0;
            return (
              <div key={s.step} style={css("display:flex;align-items:center;gap:12px")}>
                <div style={css("width:96px;flex:0 0 auto;font-size:13px;font-weight:600;color:var(--ink);text-transform:capitalize")}>{s.step.replace("_", " ")}</div>
                <div style={css("flex:1;height:22px;border-radius:6px;background:var(--putty);overflow:hidden;position:relative")}>
                  <div style={sx("height:100%;border-radius:6px;transition:width .3s", { width: `${pct}%`, background: "var(--maroon)" })} />
                </div>
                <div style={css("width:110px;flex:0 0 auto;text-align:right;font-size:13px;color:var(--muted)")}><b style={css("color:var(--ink)")}>{num(s.users)}</b> · {pct}%</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Screens + listings + clicks */}
      <div style={css("display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px")}>
        <RankList title="Top screens" rows={(data?.topScreens ?? []).map((s) => [s.screen, s.views])} />
        <RankList title="Most-viewed listings" rows={(data?.topListings ?? []).map((l) => [`Listing #${l.listingId}`, l.views])} />
        <RankList title="Top click targets" rows={(data?.topClicks ?? []).map((c) => [c.name.replace(/^click:/, ""), c.count])} />
      </div>

      {/* Recent events */}
      <div style={css(CARD)}>
        <div style={css("font-size:15px;font-weight:800;margin-bottom:12px")}>Recent events</div>
        <div style={css("display:flex;flex-direction:column;gap:0;max-height:340px;overflow-y:auto")}>
          {(data?.recent ?? []).length === 0 ? (
            <div style={css("font-size:13px;color:var(--muted);padding:8px 0")}>No events yet — they&apos;ll appear here as people use the site.</div>
          ) : (data?.recent ?? []).map((e, i) => (
            <div key={i} style={css("display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--line);font-size:12.5px")}>
              <span style={css("font-family:ui-monospace,Menlo,monospace;color:var(--muted);flex:0 0 auto")}>{e.anonId}</span>
              <span style={css("font-weight:700;color:var(--ink)")}>{e.name}</span>
              <span style={css("color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{e.path || e.screen || ""}</span>
              <span style={css("margin-left:auto;flex:0 0 auto;color:var(--muted)")}>{new Date(e.ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RankList({ title, rows }: { title: string; rows: [string, number][] }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <div style={css(CARD)}>
      <div style={css("font-size:15px;font-weight:800;margin-bottom:12px")}>{title}</div>
      {rows.length === 0 ? (
        <div style={css("font-size:13px;color:var(--muted)")}>No data yet.</div>
      ) : (
        <div style={css("display:flex;flex-direction:column;gap:8px")}>
          {rows.slice(0, 12).map(([label, val]) => (
            <div key={label} style={css("display:flex;align-items:center;gap:10px")}>
              <div style={css("flex:1;min-width:0")}>
                <div style={css("display:flex;justify-content:space-between;gap:8px;margin-bottom:3px")}>
                  <span style={css("font-size:12.5px;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{label}</span>
                  <span style={css("font-size:12.5px;font-weight:700;color:var(--ink);flex:0 0 auto")}>{num(val)}</span>
                </div>
                <div style={css("height:5px;border-radius:3px;background:var(--putty);overflow:hidden")}>
                  <div style={sx("height:100%;border-radius:3px", { width: `${Math.round((val / max) * 100)}%`, background: "var(--blueInk)" })} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AnalyticsAdmin;
