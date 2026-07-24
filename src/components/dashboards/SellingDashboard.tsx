"use client";

// Seller dashboard — offers received on the seller's listings (with Accept /
// Counter / Decline), the seller's own listings, and headline stats including
// real payout totals. Rebuilt to the account design language: Reckless-serif
// headings, paper cards, plum primary buttons, pill status badges.
//
// Data: getSellingData() server function. Mutations: PATCH /api/offers/[id]
// with { action, counterCents? }. Everything fail-soft — a failed action leaves
// the row untouched and never throws; a missing DB shows real empty states.

import { useEffect, useState } from "react";
import { css, sx, Hoverable } from "@/lib/design/css";
import { Plus, ChevronLeft } from "@/components/marketplace/icons";
import { formatPrice } from "@/lib/listing";
import { getSellingData } from "@/lib/dashboards";
import type { SellingData, SellingListing, OfferDTO } from "@/lib/dashboards";

const EMPTY: SellingData = {
  offers: [],
  listings: [],
  stats: { activeListings: 0, newOffers: 0, totalViews: 0, paidOutCents: 0 },
};

const GRADIENT = "repeating-linear-gradient(135deg,#EDE4D6 0 8px,#E5DACA 8px 16px)";

/* --------------------------------- helpers ---------------------------------- */

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const OFFER_TONE: Record<OfferDTO["status"], { label: string; bg: string; color: string }> = {
  pending: { label: "Pending", bg: "var(--blueBg)", color: "var(--blueInk)" },
  countered: { label: "Countered", bg: "#F7EDCE", color: "var(--gold)" },
  accepted: { label: "Accepted", bg: "var(--greenBg)", color: "var(--green)" },
  declined: { label: "Declined", bg: "#F5EAE7", color: "var(--red)" },
};

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

/* -------------------------------- primitives -------------------------------- */

function StatusBadge({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span style={sx("display:inline-block;font-size:12px;font-weight:800;padding:4px 11px;border-radius:20px;white-space:nowrap", { background: bg, color })}>
      {label}
    </span>
  );
}

function PrimaryButton({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <Hoverable
      as="button"
      onClick={onClick}
      disabled={disabled}
      styles={sx(
        "display:inline-flex;align-items:center;gap:7px;background:var(--maroon);color:#fff;border:none;border-radius:10px;padding:10px 16px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap",
        disabled ? { opacity: 0.55, cursor: "wait" } : undefined,
      )}
      hover={disabled ? "" : "filter:brightness(1.08)"}
    >
      {children}
    </Hoverable>
  );
}

function GhostButton({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <Hoverable
      as="button"
      onClick={onClick}
      disabled={disabled}
      styles={sx(
        "display:inline-flex;align-items:center;gap:6px;background:var(--paper);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:9px 14px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap",
        disabled ? { opacity: 0.55, cursor: "wait" } : undefined,
      )}
      hover={disabled ? "" : "border-color:#d9b7c2;box-shadow:0 4px 12px rgba(60,10,35,.08)"}
    >
      {children}
    </Hoverable>
  );
}

/** Placeholder-tolerant thumbnail. */
function Thumb({ src, size = 60 }: { src: string | null; size?: number }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        loading="lazy"
        style={sx("flex:0 0 auto;object-fit:cover;border-radius:10px;border:1px solid var(--line)", { width: `${size}px`, height: `${size}px` })}
      />
    );
  }
  return (
    <div style={sx("flex:0 0 auto;border-radius:10px;border:1px solid var(--line)", { width: `${size}px`, height: `${size}px`, background: GRADIENT })} />
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div style={css("display:flex;align-items:center;justify-content:center;gap:11px;padding:48px 20px;color:var(--muted);font-size:14px")}>
      <span style={css("width:18px;height:18px;border-radius:50%;border:2.5px solid var(--line);border-top-color:var(--maroon);display:inline-block;animation:cp-sell-spin .7s linear infinite")} />
      {label}
    </div>
  );
}

function EmptyState({ title, text, cta, onCta }: { title: string; text: string; cta: string; onCta: () => void }) {
  return (
    <div style={css("text-align:center;padding:48px 22px;background:var(--paper);border:1px solid var(--line);border-radius:14px")}>
      <div style={css("width:50px;height:50px;margin:0 auto 14px;border-radius:50%;background:var(--putty);display:flex;align-items:center;justify-content:center")}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M4 9h16l-1-4.5H5L4 9Z" /><path d="M5 9v10.5h14V9" /></svg>
      </div>
      <div style={css("font-family:'Reckless','Newsreader',serif;font-size:19px;color:var(--ink);margin-bottom:6px")}>{title}</div>
      <div style={css("font-size:14px;color:var(--muted);max-width:400px;margin:0 auto 16px;line-height:1.5")}>{text}</div>
      <PrimaryButton onClick={onCta}><Plus size={15} stroke="#fff" />{cta}</PrimaryButton>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={css("font-family:'Reckless','Newsreader',serif;font-size:22px;font-weight:600;letter-spacing:-.3px;color:var(--ink);margin-bottom:14px")}>
      {children}
    </h2>
  );
}

/* --------------------------------- component -------------------------------- */

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

  const stats = [
    { n: String(d.stats.activeListings ?? 0), l: "Active listings", c: "var(--ink)" },
    { n: String(d.stats.newOffers ?? 0), l: "Offers received", c: "var(--maroon)" },
    { n: Number(d.stats.totalViews ?? 0).toLocaleString(), l: "Total views", c: "var(--ink)" },
    { n: formatPrice(d.stats.paidOutCents ?? 0), l: "Total payout", c: "var(--green)" },
  ];

  return (
    <div style={css("max-width:960px;margin:0 auto")}>
      <style>{"@keyframes cp-sell-spin{to{transform:rotate(360deg)}}@media(max-width:720px){[data-sell-stats]{grid-template-columns:repeat(2,1fr)!important}}"}</style>

      {/* Breadcrumb */}
      <div style={css("display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--muted);margin-bottom:18px")}>
        <Hoverable as="span" onClick={onBrowse} styles="display:inline-flex;align-items:center;gap:3px;cursor:pointer;color:var(--blueInk);font-weight:600" hover="text-decoration:underline">
          <ChevronLeft size={13} stroke="currentColor" />Browse
        </Hoverable>
        <span>/</span>
        <span style={css("color:var(--ink)")}>Selling</span>
      </div>

      {/* Header */}
      <div style={css("display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:14px;margin-bottom:26px")}>
        <div>
          <h1 style={css("font-family:'Reckless','Newsreader',serif;font-size:clamp(28px,4vw,38px);font-weight:500;letter-spacing:-.5px;line-height:1.05;margin-bottom:6px")}>Selling</h1>
          <p style={css("color:var(--muted);font-size:14.5px")}>Manage listings, review offers, and track payouts.</p>
        </div>
        <PrimaryButton onClick={onNew}><Plus size={16} stroke="#fff" />Create new listing</PrimaryButton>
      </div>

      {/* Stat tiles */}
      <div data-sell-stats style={css("display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:34px")}>
        {stats.map((s) => (
          <div key={s.l} style={css("background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:18px")}>
            <div style={sx("font-size:26px;font-weight:800;letter-spacing:-.6px;line-height:1.1", { color: s.c })}>{loading ? "…" : s.n}</div>
            <div style={css("font-size:13px;color:var(--muted);margin-top:4px")}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Offers received */}
      <SectionHeading>Offers received</SectionHeading>
      <p style={css("color:var(--muted);font-size:13.5px;margin-top:-8px;margin-bottom:16px")}>Accept, counter, or decline each offer buyers make on your listings.</p>
      {loading ? (
        <div style={css("margin-bottom:36px")}><Loading label="Loading offers…" /></div>
      ) : d.offers.length > 0 ? (
        <div style={css("display:flex;flex-direction:column;gap:12px;margin-bottom:36px")}>
          {d.offers.map((o) => {
            const pending = o.status === "pending";
            const isCountering = counteringId === o.id;
            const busy = busyId === o.id;
            const tone = OFFER_TONE[o.status] ?? OFFER_TONE.pending;
            return (
              <div key={o.id} style={css("display:flex;align-items:flex-start;gap:14px;background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:15px;flex-wrap:wrap")}>
                <Thumb src={o.listingImage} size={62} />
                <div style={css("flex:1;min-width:200px")}>
                  <div style={css("display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:5px")}>
                    <span style={css("font-size:15px;font-weight:700;line-height:1.3")}>{o.listingTitle}</span>
                    <StatusBadge label={tone.label} bg={tone.bg} color={tone.color} />
                  </div>
                  <div style={css("font-size:13.5px;color:var(--ink)")}>
                    <b>{o.buyerName}</b>
                    {o.buyerState ? <span style={css("color:var(--muted)")}> ({o.buyerState})</span> : null} offered{" "}
                    <b style={css("color:var(--maroon)")}>{formatPrice(o.amountCents)}</b>
                    {o.listPriceCents > 0 ? (
                      <span style={css("color:var(--muted)")}>
                        {" "}· list {formatPrice(o.listPriceCents)}
                        {o.pctOfAsking > 0 ? ` · ${o.pctOfAsking}% of asking` : ""}
                      </span>
                    ) : null}
                  </div>
                  {o.status === "countered" && o.counterCents != null && (
                    <div style={css("font-size:13px;color:var(--gold);font-weight:700;margin-top:3px")}>You countered at {formatPrice(o.counterCents)}</div>
                  )}
                  <div style={css("font-size:12.5px;color:var(--muted);margin-top:4px")}>{fmtDate(o.createdAt)}</div>

                  {/* Actions */}
                  {isCountering ? (
                    <div style={css("display:flex;align-items:center;gap:9px;margin-top:12px;flex-wrap:wrap")}>
                      <div style={css("display:flex;align-items:center;background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:0 11px")}>
                        <span style={css("color:var(--muted);font-size:14px")}>$</span>
                        <input
                          value={counterVal}
                          onChange={(e) => setCounterVal(e.target.value.replace(/[^\d]/g, ""))}
                          inputMode="numeric"
                          autoFocus
                          placeholder="Amount"
                          style={css("width:96px;border:none;outline:none;padding:10px 5px;font-size:14px;font-weight:600;background:transparent;color:var(--ink);font-family:inherit")}
                        />
                      </div>
                      <PrimaryButton disabled={busy} onClick={() => confirmCounter(o.id)}>{busy ? "Sending…" : "Send counter"}</PrimaryButton>
                      <GhostButton disabled={busy} onClick={() => { setCounteringId(null); setCounterVal(""); }}>Cancel</GhostButton>
                    </div>
                  ) : pending ? (
                    <div style={css("display:flex;gap:9px;margin-top:12px;flex-wrap:wrap")}>
                      <PrimaryButton disabled={busy} onClick={() => act(o.id, "accept")}>{busy ? "Working…" : "Accept"}</PrimaryButton>
                      <GhostButton disabled={busy} onClick={() => startCounter(o)}>Counter</GhostButton>
                      <GhostButton disabled={busy} onClick={() => act(o.id, "decline")}>Decline</GhostButton>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={css("margin-bottom:36px")}>
          <EmptyState title="No offers yet" text="When buyers make offers on your listings, they'll appear here to accept, counter, or decline." cta="Create new listing" onCta={onNew} />
        </div>
      )}

      {/* Your listings */}
      <SectionHeading>Your listings</SectionHeading>
      {loading ? (
        <Loading label="Loading listings…" />
      ) : d.listings.length > 0 ? (
        <div style={css("display:flex;flex-direction:column;gap:12px")}>
          {d.listings.map((l) => (
            <ListingRow key={l.id} l={l} />
          ))}
        </div>
      ) : (
        <EmptyState title="No active listings" text="List something you no longer need — we handle pickup, delivery, and payment." cta="Create your first listing" onCta={onNew} />
      )}
    </div>
  );
}

function ListingRow({ l }: { l: SellingListing }) {
  return (
    <div style={css("display:flex;align-items:center;gap:14px;background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:14px 15px")}>
      <Thumb src={l.image} size={60} />
      <div style={css("flex:1;min-width:0")}>
        <div style={css("font-size:15px;font-weight:600;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{l.title}</div>
        <div style={css("display:flex;align-items:center;gap:7px;font-size:12.5px;color:var(--muted);margin-top:3px;flex-wrap:wrap")}>
          {l.categoryName ? <span>{l.categoryName}</span> : null}
          {l.categoryName ? <span>·</span> : null}
          <span>{Number(l.estViews ?? 0).toLocaleString()} views</span>
        </div>
      </div>
      <div style={css("display:flex;flex-direction:column;align-items:flex-end;gap:7px")}>
        <div style={css("font-size:16px;font-weight:800;letter-spacing:-.3px")}>{formatPrice(l.priceCents)}</div>
        <StatusBadge label="Active" bg="var(--greenBg)" color="var(--green)" />
      </div>
    </div>
  );
}
