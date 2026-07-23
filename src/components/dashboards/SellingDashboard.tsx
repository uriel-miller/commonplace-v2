"use client";

// Seller dashboard — offers on the seller's listings (with Accept / Counter /
// Decline), active listings, and headline stats incl. real payout totals. Look
// ported 1:1 from MarketplaceApp's Selling view (stat tiles + list rows).
//
// Data: getSellingData() server function. Mutations: PATCH /api/offers/[id]
// with { action, counterCents? }. Everything fail-soft — a failed action leaves
// the row untouched and never throws; a missing DB shows real empty states.

import { useEffect, useState } from "react";
import { css, sx } from "@/lib/design/css";
import { ChevronLeft, Plus, Pin } from "@/components/marketplace/icons";
import { formatPrice } from "@/lib/listing";
import { getSellingData } from "@/lib/dashboards";
import type { SellingData, SellingListing, OfferDTO } from "@/lib/dashboards";

const EMPTY: SellingData = {
  offers: [],
  listings: [],
  stats: { activeListings: 0, newOffers: 0, totalViews: 0, paidOutCents: 0 },
};

const GRADIENT = "repeating-linear-gradient(135deg,#EDE4D6 0 10px,#E5DACA 10px 20px)";

function initialOf(name: string): string {
  const c = name.trim().charAt(0).toUpperCase();
  return c || "?";
}

function avatarBg(name: string): string {
  const palette = ["var(--maroon)", "var(--blueInk)", "var(--green)", "var(--gold)", "var(--purple)"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function resolvedPill(status: OfferDTO["status"]): { bg: string; color: string; label: string } {
  switch (status) {
    case "accepted":
      return { bg: "var(--greenBg)", color: "var(--green)", label: "Accepted" };
    case "countered":
      return { bg: "var(--yellowBg)", color: "var(--gold)", label: "Countered" };
    case "declined":
      return { bg: "#F1E7E4", color: "var(--red)", label: "Declined" };
    default:
      return { bg: "var(--blueBg)", color: "var(--blueInk)", label: "Pending" };
  }
}

type PatchResult = { ok?: boolean; offer?: OfferDTO | null } | null;

/** PATCH the offer; return the updated DTO or null on any failure. Never throws. */
async function patchOffer(id: string, action: "accept" | "counter" | "decline", counterCents?: number): Promise<OfferDTO | null> {
  try {
    const res = await fetch(`/api/offers/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, counterCents }),
    });
    const body = (await res.json().catch(() => null)) as PatchResult;
    if (body && body.ok && body.offer) return body.offer;
    return null;
  } catch {
    return null;
  }
}

export function SellingDashboard({ onBrowse, onNew }: { onBrowse: () => void; onNew: () => void }) {
  const [data, setData] = useState<SellingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [counteringId, setCounteringId] = useState<string | null>(null);
  const [counterVal, setCounterVal] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getSellingData()
      .then((d) => {
        if (alive) setData(d);
      })
      .catch(() => {
        if (alive) setData(EMPTY);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const d = data ?? EMPTY;

  function applyUpdate(updated: OfferDTO) {
    setData((prev) => {
      const base = prev ?? EMPTY;
      const offers = base.offers.map((o) => (o.id === updated.id ? updated : o));
      const newOffers = offers.filter((o) => o.status === "pending").length;
      return { ...base, offers, stats: { ...base.stats, newOffers } };
    });
  }

  async function act(id: string, action: "accept" | "decline") {
    setBusyId(id);
    const updated = await patchOffer(id, action);
    if (updated) applyUpdate(updated);
    setBusyId(null);
  }

  function startCounter(o: OfferDTO) {
    setCounteringId(o.id);
    // Seed with the buyer's offer as a sensible starting point.
    setCounterVal(String(Math.round((o.counterCents ?? o.amountCents) / 100)));
  }

  async function confirmCounter(id: string) {
    const dollars = Number(counterVal);
    if (!Number.isFinite(dollars) || dollars <= 0) return;
    setBusyId(id);
    const updated = await patchOffer(id, "counter", Math.round(dollars * 100));
    if (updated) applyUpdate(updated);
    setBusyId(null);
    setCounteringId(null);
    setCounterVal("");
  }

  return (
    <div style={css("max-width:960px")}>
      <div style={css("display:flex;align-items:center;gap:10px;margin-bottom:4px")}>
        <a onClick={onBrowse} style={css("color:var(--blueInk);font-size:14px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:4px")}>
          <ChevronLeft stroke="currentColor" />Browse
        </a>
        <span style={css("color:var(--muted);font-size:14px")}>/ Selling</span>
      </div>
      <div style={css("display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:22px")}>
        <div>
          <h2 style={css("font-family:'Reckless','Newsreader',serif;font-size:30px;font-weight:500;letter-spacing:-.4px;margin-bottom:2px")}>Your seller dashboard</h2>
          <p style={css("color:var(--muted);font-size:14px")}>Manage listings, review offers, and track payouts.</p>
        </div>
        <button onClick={onNew} style={css("background:var(--blueInk);color:#fff;border:none;border-radius:9px;padding:11px 18px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:7px")}>
          <Plus size={16} />New listing
        </button>
      </div>

      {/* Stat tiles */}
      <div style={css("display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:26px")}>
        {([
          [String(d.stats.activeListings), "Active listings", "var(--ink)"],
          [String(d.stats.newOffers), "New offers", "var(--blueInk)"],
          [d.stats.totalViews.toLocaleString(), "Total views", "var(--ink)"],
          [formatPrice(d.stats.paidOutCents), "Paid out", "var(--green)"],
        ] as const).map(([n, l, c]) => (
          <div key={l} style={css("background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px")}>
            <div style={sx("font-size:26px;font-weight:800;letter-spacing:-.5px", { color: c })}>{loading ? "…" : n}</div>
            <div style={css("font-size:12.5px;color:var(--muted)")}>{l}</div>
          </div>
        ))}
      </div>

      {/* Offers */}
      <h3 style={css("font-size:19px;font-weight:800;margin-bottom:2px")}>Offers on your listings</h3>
      <p style={css("color:var(--muted);font-size:13px;margin-bottom:12px")}>You have 24 hours to accept, counter, or decline each offer.</p>
      {loading ? (
        <SkeletonRows avatar />
      ) : d.offers.length > 0 ? (
        <div style={css("display:flex;flex-direction:column;gap:11px;margin-bottom:30px")}>
          {d.offers.map((o) => {
            const pending = o.status === "pending";
            const isCountering = counteringId === o.id;
            const busy = busyId === o.id;
            const pill = resolvedPill(o.status);
            return (
              <div key={o.id} style={css("display:flex;align-items:center;gap:14px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 14px;flex-wrap:wrap")}>
                <div style={sx("width:44px;height:44px;flex:0 0 auto;border-radius:50%;color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;font-size:15px", { background: avatarBg(o.buyerName) })}>{initialOf(o.buyerName)}</div>
                <div style={css("flex:1;min-width:140px")}>
                  <div style={css("font-size:14px;line-height:1.3")}>
                    <b>{o.buyerName}</b>
                    {o.buyerState && <span style={css("color:var(--muted);font-weight:600")}> ({o.buyerState})</span>} offered <b style={css("color:var(--blueInk)")}>{formatPrice(o.amountCents)}</b>
                  </div>
                  <div style={css("font-size:12.5px;color:var(--muted);margin-top:2px")}>
                    {o.listingTitle}
                    {o.listPriceCents > 0 && <> · list {formatPrice(o.listPriceCents)}</>}
                    {o.pctOfAsking > 0 && <> · {o.pctOfAsking}% of asking</>}
                  </div>
                  {o.status === "countered" && o.counterCents != null && (
                    <div style={css("font-size:12.5px;color:var(--gold);font-weight:700;margin-top:3px")}>You countered at {formatPrice(o.counterCents)}</div>
                  )}
                </div>

                {isCountering ? (
                  <div style={css("display:flex;align-items:center;gap:7px")}>
                    <div style={css("display:flex;align-items:center;background:#fff;border:1px solid var(--line);border-radius:8px;padding:0 10px")}>
                      <span style={css("color:var(--muted);font-size:13px")}>$</span>
                      <input
                        value={counterVal}
                        onChange={(e) => setCounterVal(e.target.value.replace(/[^\d]/g, ""))}
                        inputMode="numeric"
                        autoFocus
                        placeholder="Amount"
                        style={css("width:88px;border:none;outline:none;padding:8px 4px;font-size:13px;font-weight:600;background:transparent;color:var(--ink)")}
                      />
                    </div>
                    <button disabled={busy} onClick={() => confirmCounter(o.id)} style={sx("border:none;background:var(--blueInk);color:#fff;border-radius:8px;padding:8px 14px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit", busy ? { opacity: 0.6, cursor: "wait" } : undefined)}>Send</button>
                    <button disabled={busy} onClick={() => { setCounteringId(null); setCounterVal(""); }} style={css("border:1px solid var(--line);background:#fff;color:var(--muted);border-radius:8px;padding:8px 12px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit")}>Cancel</button>
                  </div>
                ) : pending ? (
                  <div style={css("display:flex;gap:7px")}>
                    <button disabled={busy} onClick={() => act(o.id, "decline")} style={sx("border:1px solid var(--line);background:#fff;color:var(--muted);border-radius:8px;padding:8px 13px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit", busy ? { opacity: 0.6, cursor: "wait" } : undefined)}>Decline</button>
                    <button disabled={busy} onClick={() => startCounter(o)} style={sx("border:1px solid var(--blueInk);background:#fff;color:var(--blueInk);border-radius:8px;padding:8px 13px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit", busy ? { opacity: 0.6, cursor: "wait" } : undefined)}>Counter</button>
                    <button disabled={busy} onClick={() => act(o.id, "accept")} style={sx("border:none;background:var(--blueInk);color:#fff;border-radius:8px;padding:8px 15px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit", busy ? { opacity: 0.6, cursor: "wait" } : undefined)}>Accept</button>
                  </div>
                ) : (
                  <span style={sx("font-size:12px;font-weight:700;padding:6px 14px;border-radius:20px", { background: pill.bg, color: pill.color })}>{pill.label}</span>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyRow title="No offers yet" text="When buyers make offers on your listings, they'll appear here to accept, counter, or decline." action="New listing" onAction={onNew} />
      )}

      {/* Listings */}
      <h3 style={css("font-size:19px;font-weight:800;margin-bottom:12px")}>Your listings</h3>
      {loading ? (
        <SkeletonRows />
      ) : d.listings.length > 0 ? (
        <div style={css("display:flex;flex-direction:column;gap:11px;margin-bottom:30px")}>
          {d.listings.map((l) => (
            <ListingRow key={l.id} l={l} />
          ))}
        </div>
      ) : (
        <EmptyRow title="No active listings" text="Create your first listing and it'll show up here with views and offers." action="New listing" onAction={onNew} />
      )}
    </div>
  );
}

function ListingRow({ l }: { l: SellingListing }) {
  return (
    <div style={css("display:flex;align-items:center;gap:14px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 14px")}>
      {l.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={l.image} alt="" loading="lazy" style={css("width:60px;height:60px;flex:0 0 auto;border-radius:9px;object-fit:cover")} />
      ) : (
        <div style={sx("width:60px;height:60px;flex:0 0 auto;border-radius:9px", { background: GRADIENT })} />
      )}
      <div style={css("flex:1;min-width:0")}>
        <div style={css("font-size:14.5px;font-weight:600;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{l.title}</div>
        <div style={css("display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--muted);margin-top:2px")}>
          <span style={css("display:inline-flex;align-items:center;gap:3px")}><Pin size={12} />{l.categoryName}</span>
          <span>· {l.estViews.toLocaleString()} views</span>
        </div>
      </div>
      <div style={css("font-size:16px;font-weight:800;letter-spacing:-.3px")}>{formatPrice(l.priceCents)}</div>
    </div>
  );
}

function SkeletonRows({ avatar = false }: { avatar?: boolean }) {
  return (
    <div style={css("display:flex;flex-direction:column;gap:11px;margin-bottom:30px")}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} style={css("display:flex;align-items:center;gap:14px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 14px")}>
          <div style={sx(avatar ? "width:44px;height:44px;border-radius:50%" : "width:60px;height:60px;border-radius:9px", "flex:0 0 auto", { background: GRADIENT, opacity: 0.55 })} />
          <div style={css("flex:1")}>
            <div style={css("height:12px;width:55%;border-radius:5px;background:var(--putty);margin-bottom:8px")} />
            <div style={css("height:11px;width:35%;border-radius:5px;background:var(--putty)")} />
          </div>
          <div style={css("height:30px;width:150px;border-radius:8px;background:var(--putty)")} />
        </div>
      ))}
    </div>
  );
}

function EmptyRow({ title, text, action, onAction }: { title: string; text: string; action: string; onAction: () => void }) {
  return (
    <div style={css("text-align:center;padding:34px 20px;background:#fff;border:1px dashed var(--line);border-radius:12px;margin-bottom:30px")}>
      <div style={css("font-family:'Reckless','Newsreader',serif;font-size:18px;color:var(--ink);margin-bottom:4px")}>{title}</div>
      <div style={css("font-size:13.5px;color:var(--muted);margin-bottom:14px;max-width:420px;margin-left:auto;margin-right:auto;line-height:1.5")}>{text}</div>
      <button onClick={onAction} style={css("border:none;background:var(--blueInk);color:#fff;border-radius:9px;padding:9px 16px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:6px")}>
        <Plus size={15} stroke="#fff" />{action}
      </button>
    </div>
  );
}
