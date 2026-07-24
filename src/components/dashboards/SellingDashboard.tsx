"use client";

// Seller dashboard — offers received on the seller's listings (with Accept /
// Counter / Decline), the seller's own listings, and headline stats including
// real payout totals. Premium presentation over the account design language:
// Reckless-serif headings, tinted stat tiles with icon badges, paper cards
// with hover lift, plum primary buttons, pill status badges.
//
// Data: getSellingData() server function. Mutations: PATCH /api/offers/[id]
// with { action, counterCents? }. Everything fail-soft — a failed action leaves
// the row untouched and never throws; a missing DB shows real empty states.

import { useEffect, useState } from "react";
import { css, sx, Hoverable } from "@/lib/design/css";
import { Plus, ChevronLeft } from "@/components/marketplace/icons";
import { formatPrice } from "@/lib/listing";
import { getSellingData } from "@/lib/dashboards";
import type { SellingData, SellingListing, DashboardComment, OfferDTO } from "@/lib/dashboards";

const EMPTY: SellingData = {
  offers: [],
  listings: [],
  comments: [],
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

/* ------------------------------- stat icons --------------------------------- */

type IconProps = { color: string };

function IconTag({ color }: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7-7A2 2 0 0 1 3 12.2V4a1 1 0 0 1 1-1h8.2a2 2 0 0 1 1.4.6l7 7a2 2 0 0 1 0 2.8Z" />
      <circle cx="7.5" cy="7.5" r="1.3" />
    </svg>
  );
}

function IconOffer({ color }: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5h16v11H7l-3 3V5Z" />
      <path d="M9 10h6" />
      <path d="M9 13h4" />
    </svg>
  );
}

function IconEye({ color }: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconPayout({ color }: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20" />
      <path d="M17 5.5C17 4 15.2 3 12.5 3S8 4.2 8 6s2 2.5 4.5 3 4.5 1.5 4.5 3.5-2 3.5-5 3.5-5-1.2-5-2.8" />
    </svg>
  );
}

/* -------------------------------- primitives -------------------------------- */

function StatusBadge({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span style={sx("display:inline-block;font-size:12px;font-weight:800;padding:4px 11px;border-radius:20px;white-space:nowrap;letter-spacing:.1px", { background: bg, color })}>
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
        "display:inline-flex;align-items:center;gap:7px;background:var(--maroon);color:#fff;border:none;border-radius:11px;padding:11px 17px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;box-shadow:0 2px 8px rgba(60,10,35,.18);transition:filter .15s,box-shadow .15s,transform .15s",
        disabled ? { opacity: 0.55, cursor: "wait" } : undefined,
      )}
      hover={disabled ? "" : "filter:brightness(1.09);box-shadow:0 6px 18px rgba(60,10,35,.26);transform:translateY(-1px)"}
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
        "display:inline-flex;align-items:center;gap:6px;background:var(--paper);color:var(--ink);border:1px solid var(--line);border-radius:11px;padding:10px 15px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;transition:border-color .15s,box-shadow .15s,transform .15s",
        disabled ? { opacity: 0.55, cursor: "wait" } : undefined,
      )}
      hover={disabled ? "" : "border-color:#d9b7c2;box-shadow:0 4px 12px rgba(60,10,35,.08);transform:translateY(-1px)"}
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
        style={sx("flex:0 0 auto;object-fit:cover;border-radius:12px;border:1px solid var(--line)", { width: `${size}px`, height: `${size}px` })}
      />
    );
  }
  return (
    <div style={sx("flex:0 0 auto;border-radius:12px;border:1px solid var(--line)", { width: `${size}px`, height: `${size}px`, background: GRADIENT })} />
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
    <div style={css("text-align:center;padding:52px 22px;background:var(--paper);border:1px solid var(--line);border-radius:16px;box-shadow:0 1px 3px rgba(60,10,35,.04)")}>
      <div style={css("width:56px;height:56px;margin:0 auto 16px;border-radius:50%;background:var(--tint);display:flex;align-items:center;justify-content:center")}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--maroon)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M4 9h16l-1-4.5H5L4 9Z" /><path d="M5 9v10.5h14V9" /></svg>
      </div>
      <div style={css("font-family:'Reckless','Newsreader',serif;font-size:20px;color:var(--ink);margin-bottom:6px")}>{title}</div>
      <div style={css("font-size:14px;color:var(--muted);max-width:400px;margin:0 auto 18px;line-height:1.5")}>{text}</div>
      <PrimaryButton onClick={onCta}><Plus size={15} stroke="#fff" />{cta}</PrimaryButton>
    </div>
  );
}

function SellComment({ c }: { c: DashboardComment }) {
  return (
    <div style={css("background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:15px 17px")}>
      <div style={css("display:flex;align-items:center;gap:10px;margin-bottom:9px")}>
        <div style={css("width:34px;height:34px;flex:0 0 auto;border-radius:8px;overflow:hidden;background:var(--putty)")}>
          {c.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.image} alt="" style={css("width:100%;height:100%;object-fit:cover")} />
          ) : null}
        </div>
        <div style={css("font-size:13px;font-weight:700;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{c.item}</div>
        <span style={sx("margin-left:auto;flex:0 0 auto;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700", c.answered ? { background: "var(--greenBg)", color: "var(--green)" } : { background: "var(--yellowBg)", color: "var(--gold)" })}>{c.answered ? "Answered" : "Needs a reply"}</span>
      </div>
      <div style={css("font-size:13.5px;color:var(--ink);line-height:1.5")}><b>Q:</b> {c.question}</div>
      {c.answered && c.answer && (
        <div style={css("font-size:13px;color:var(--muted);line-height:1.5;margin-top:6px;padding-left:12px;border-left:2px solid var(--line)")}><b style={css("color:var(--maroon)")}>Commonplace:</b> {c.answer}</div>
      )}
    </div>
  );
}

function SectionHeading({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div style={css("margin-bottom:16px")}>
      <h2 style={css("font-family:'Reckless','Newsreader',serif;font-size:23px;font-weight:600;letter-spacing:-.3px;color:var(--ink)")}>
        {children}
      </h2>
      {sub ? <p style={css("color:var(--muted);font-size:13.5px;margin-top:4px")}>{sub}</p> : null}
    </div>
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

  const stats: { n: string; l: string; accent: string; bg: string; icon: React.ReactNode }[] = [
    { n: String(d.stats.activeListings ?? 0), l: "Active listings", accent: "var(--blueInk)", bg: "var(--blueBg)", icon: <IconTag color="var(--blueInk)" /> },
    { n: String(d.stats.newOffers ?? 0), l: "Offers received", accent: "var(--maroon)", bg: "var(--tint)", icon: <IconOffer color="var(--maroon)" /> },
    { n: Number(d.stats.totalViews ?? 0).toLocaleString(), l: "Total views", accent: "var(--gold)", bg: "var(--yellowBg)", icon: <IconEye color="var(--gold)" /> },
    { n: formatPrice(d.stats.paidOutCents ?? 0), l: "Total payout", accent: "var(--green)", bg: "var(--greenBg)", icon: <IconPayout color="var(--green)" /> },
  ];

  return (
    <div style={css("max-width:1040px;margin:0 auto")}>
      <style>{"@keyframes cp-sell-spin{to{transform:rotate(360deg)}}@media(max-width:760px){[data-sell-stats]{grid-template-columns:repeat(2,1fr)!important}[data-sell-grid]{grid-template-columns:repeat(2,1fr)!important}}@media(max-width:520px){[data-sell-stats]{grid-template-columns:1fr!important}[data-sell-grid]{grid-template-columns:1fr!important}}"}</style>

      {/* Breadcrumb */}
      <div style={css("display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--muted);margin-bottom:18px")}>
        <Hoverable as="span" onClick={onBrowse} styles="display:inline-flex;align-items:center;gap:3px;cursor:pointer;color:var(--blueInk);font-weight:600" hover="text-decoration:underline">
          <ChevronLeft size={13} stroke="currentColor" />Browse
        </Hoverable>
        <span>/</span>
        <span style={css("color:var(--ink)")}>Selling</span>
      </div>

      {/* Header */}
      <div style={css("display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:14px;margin-bottom:28px")}>
        <div>
          <h1 style={css("font-family:'Reckless','Newsreader',serif;font-size:clamp(30px,4vw,40px);font-weight:500;letter-spacing:-.5px;line-height:1.05;margin-bottom:7px")}>Selling</h1>
          <p style={css("color:var(--muted);font-size:14.5px")}>Manage listings, review offers, and track payouts.</p>
        </div>
        <PrimaryButton onClick={onNew}><Plus size={16} stroke="#fff" />Create new listing</PrimaryButton>
      </div>

      {/* Stat tiles */}
      <div data-sell-stats style={css("display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:38px")}>
        {stats.map((s) => (
          <div key={s.l} style={sx("border-radius:16px;padding:18px 18px 20px;box-shadow:0 1px 3px rgba(60,10,35,.05);border:1px solid rgba(60,10,35,.04)", { background: s.bg })}>
            <div style={sx("width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--paper);box-shadow:0 1px 4px rgba(60,10,35,.08);margin-bottom:14px")}>
              {s.icon}
            </div>
            <div style={sx("font-family:'Reckless','Newsreader',serif;font-size:32px;font-weight:600;letter-spacing:-.8px;line-height:1", { color: s.accent })}>{loading ? "…" : s.n}</div>
            <div style={css("font-size:13px;color:var(--muted);margin-top:6px;font-weight:500")}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Offers received */}
      <SectionHeading sub="Accept, counter, or decline each offer buyers make on your listings.">Offers received</SectionHeading>
      {loading ? (
        <div style={css("margin-bottom:40px")}><Loading label="Loading offers…" /></div>
      ) : d.offers.length > 0 ? (
        <div style={css("display:flex;flex-direction:column;gap:13px;margin-bottom:40px")}>
          {d.offers.map((o) => {
            const pending = o.status === "pending";
            const isCountering = counteringId === o.id;
            const busy = busyId === o.id;
            const tone = OFFER_TONE[o.status] ?? OFFER_TONE.pending;
            return (
              <Hoverable
                key={o.id}
                styles="display:flex;align-items:flex-start;gap:15px;background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:16px 17px;flex-wrap:wrap;box-shadow:0 1px 3px rgba(60,10,35,.04);transition:box-shadow .16s,transform .16s"
                hover="box-shadow:0 8px 22px rgba(60,10,35,.09);transform:translateY(-2px)"
              >
                <Thumb src={o.listingImage} size={66} />
                <div style={css("flex:1;min-width:200px")}>
                  <div style={css("display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px")}>
                    <span style={css("font-size:15.5px;font-weight:700;line-height:1.3")}>{o.listingTitle}</span>
                    <StatusBadge label={tone.label} bg={tone.bg} color={tone.color} />
                  </div>
                  <div style={css("font-size:13.5px;color:var(--ink);line-height:1.5")}>
                    <b>{o.buyerName}</b>
                    {o.buyerState ? <span style={css("color:var(--muted)")}> ({o.buyerState})</span> : null} offered{" "}
                    <b style={css("color:var(--maroon);font-size:14.5px")}>{formatPrice(o.amountCents)}</b>
                    {o.listPriceCents > 0 ? (
                      <span style={css("color:var(--muted)")}>
                        {" "}· list {formatPrice(o.listPriceCents)}
                        {o.pctOfAsking > 0 ? ` · ${o.pctOfAsking}% of asking` : ""}
                      </span>
                    ) : null}
                  </div>
                  {o.status === "countered" && o.counterCents != null && (
                    <div style={css("font-size:13px;color:var(--gold);font-weight:700;margin-top:4px")}>You countered at {formatPrice(o.counterCents)}</div>
                  )}
                  <div style={css("font-size:12.5px;color:var(--muted);margin-top:5px")}>{fmtDate(o.createdAt)}</div>

                  {/* Actions */}
                  {isCountering ? (
                    <div style={css("display:flex;align-items:center;gap:9px;margin-top:13px;flex-wrap:wrap")}>
                      <div style={css("display:flex;align-items:center;background:var(--cream);border:1px solid var(--line);border-radius:11px;padding:0 12px")}>
                        <span style={css("color:var(--muted);font-size:14px;font-weight:700")}>$</span>
                        <input
                          value={counterVal}
                          onChange={(e) => setCounterVal(e.target.value.replace(/[^\d]/g, ""))}
                          inputMode="numeric"
                          autoFocus
                          placeholder="Amount"
                          style={css("width:96px;border:none;outline:none;padding:11px 6px;font-size:14px;font-weight:700;background:transparent;color:var(--ink);font-family:inherit")}
                        />
                      </div>
                      <PrimaryButton disabled={busy} onClick={() => confirmCounter(o.id)}>{busy ? "Sending…" : "Send counter"}</PrimaryButton>
                      <GhostButton disabled={busy} onClick={() => { setCounteringId(null); setCounterVal(""); }}>Cancel</GhostButton>
                    </div>
                  ) : pending ? (
                    <div style={css("display:flex;gap:9px;margin-top:13px;flex-wrap:wrap")}>
                      <PrimaryButton disabled={busy} onClick={() => act(o.id, "accept")}>{busy ? "Working…" : "Accept"}</PrimaryButton>
                      <GhostButton disabled={busy} onClick={() => startCounter(o)}>Counter</GhostButton>
                      <GhostButton disabled={busy} onClick={() => act(o.id, "decline")}>Decline</GhostButton>
                    </div>
                  ) : null}
                </div>
              </Hoverable>
            );
          })}
        </div>
      ) : (
        <div style={css("margin-bottom:40px")}>
          <EmptyState title="No offers yet" text="When buyers make offers on your listings, they'll appear here to accept, counter, or decline." cta="Create new listing" onCta={onNew} />
        </div>
      )}

      {/* Your listings */}
      <SectionHeading>Your listings</SectionHeading>
      {loading ? (
        <Loading label="Loading listings…" />
      ) : d.listings.length > 0 ? (
        <div data-sell-grid style={css("display:grid;grid-template-columns:repeat(3,1fr);gap:16px")}>
          {d.listings.map((l) => (
            <ListingCard key={l.id} l={l} />
          ))}
        </div>
      ) : (
        <EmptyState title="No active listings" text="List something you no longer need — we handle pickup, delivery, and payment." cta="Create your first listing" onCta={onNew} />
      )}

      {/* Buyer questions on your listings */}
      {!loading && Array.isArray(d.comments) && d.comments.length > 0 && (
        <div style={css("margin-top:34px")}>
          <SectionHeading sub="Questions buyers have asked on your listings. Commonplace answers most from the pickup inspection.">Questions &amp; comments</SectionHeading>
          <div style={css("display:flex;flex-direction:column;gap:12px")}>
            {d.comments.map((c) => (
              <SellComment key={c.id} c={c} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ListingCard({ l }: { l: SellingListing }) {
  return (
    <Hoverable
      styles="display:flex;flex-direction:column;background:var(--paper);border:1px solid var(--line);border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(60,10,35,.04);transition:box-shadow .16s,transform .16s"
      hover="box-shadow:0 10px 26px rgba(60,10,35,.10);transform:translateY(-3px)"
    >
      {/* Cover */}
      {l.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={l.image} alt="" loading="lazy" style={css("width:100%;aspect-ratio:4/3;object-fit:cover;display:block;border-bottom:1px solid var(--line)")} />
      ) : (
        <div style={sx("width:100%;aspect-ratio:4/3;border-bottom:1px solid var(--line)", { background: GRADIENT })} />
      )}
      {/* Body */}
      <div style={css("padding:14px 15px 15px;display:flex;flex-direction:column;gap:9px;flex:1")}>
        <div style={css("font-size:15px;font-weight:600;line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{l.title}</div>
        <div style={css("display:flex;align-items:center;gap:7px;font-size:12.5px;color:var(--muted);flex-wrap:wrap")}>
          {l.categoryName ? <span>{l.categoryName}</span> : null}
          {l.categoryName ? <span>·</span> : null}
          <span>{Number(l.estViews ?? 0).toLocaleString()} views</span>
        </div>
        <div style={css("display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:auto;padding-top:4px")}>
          <div style={css("font-family:'Reckless','Newsreader',serif;font-size:20px;font-weight:600;letter-spacing:-.4px")}>{formatPrice(l.priceCents)}</div>
          <StatusBadge label="Active" bg="var(--greenBg)" color="var(--green)" />
        </div>
      </div>
    </Hoverable>
  );
}
