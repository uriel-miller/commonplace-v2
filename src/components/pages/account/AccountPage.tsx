"use client";

import { useState } from "react";
import { css, sx, Hoverable } from "@/lib/design/css";
import { formatPrice } from "@/lib/listing";
import { Pin, Plus, Close, ChevronLeft } from "@/components/marketplace/icons";
import {
  PROFILE,
  PURCHASES,
  OFFERS,
  SAVED_ITEMS,
  PAYMENT_METHODS,
  ADDRESSES,
  NOTIFICATION_SETTINGS,
  BRAND_STYLE,
  type TabKey,
  type Purchase,
  type PurchaseStatus,
  type Offer,
  type OfferStatus,
  type SavedItem,
  type PaymentMethod,
  type Address,
  type NotificationSetting,
  type Tint,
} from "./data";

// Root CSS custom properties, ported verbatim from the design wrapper so the
// page renders correctly whether it's mounted standalone or inside the shell
// (re-declaring the same variables on a nested wrapper is harmless).
const ROOT_VARS =
  "--cream:#FAF5EE;--paper:#ffffff;--ink:#231A1D;--muted:#7C7069;--line:#ECE4D8;--maroon:#5B1A2E;--maroon2:#7A2740;--tint:#F4E7EA;--putty:#f6f1ea;--gold:#C98A22;--blue:#7FA8D9;--purple:#9C88D6;--yellow:#E7C24B;--red:#C15540;--green:#3B7A57;--greenBg:#E1F0E7;--blueBg:#E4EDF8;--blueInk:#2C5B8A;--fbblue:#1877F2;--fbbtn:#E7F3FF;--yellowBg:#F7EDCE";

const TABS: { key: TabKey; label: string; count?: number }[] = [
  { key: "purchases", label: "Purchases", count: PURCHASES.length },
  { key: "offers", label: "Offers", count: OFFERS.length },
  { key: "saved", label: "Saved", count: SAVED_ITEMS.length },
  { key: "payments", label: "Payment methods" },
  { key: "addresses", label: "Addresses" },
  { key: "settings", label: "Settings" },
];

export interface AccountPageProps {
  /** Optional "back to browse" affordance; a breadcrumb renders only when set. */
  onBack?: () => void;
}

export function AccountPage({ onBack }: AccountPageProps = {}) {
  const [tab, setTab] = useState<TabKey>("purchases");

  return (
    <div
      style={sx(
        ROOT_VARS,
        "font-family:'Inter Tight',system-ui,-apple-system,'Helvetica Neue',sans-serif;color:var(--ink);min-height:100dvh;width:100%;background:var(--cream);overflow-y:auto",
      )}
    >
      <div style={css("max-width:1060px;margin:0 auto;padding:22px 22px 72px")}>
        {onBack && (
          <div style={css("display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:14px")}>
            <a onClick={onBack} style={css("color:var(--blueInk);font-weight:600;cursor:pointer;display:flex;align-items:center;gap:4px")}>
              <ChevronLeft stroke="currentColor" />Browse
            </a>
            <span style={css("color:var(--muted)")}>/ Account</span>
          </div>
        )}

        <ProfileHeader />

        {/* Tab bar */}
        <div style={css("display:flex;gap:7px;flex-wrap:wrap;border-bottom:1px solid var(--line);margin:22px 0 24px;padding-bottom:2px")}>
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <Hoverable
                key={t.key}
                onClick={() => setTab(t.key)}
                styles={sx(
                  "position:relative;display:flex;align-items:center;gap:7px;padding:10px 14px;font-size:14px;font-weight:700;cursor:pointer;border-radius:10px 10px 0 0;transition:color .15s,background .15s",
                  active ? { color: "var(--maroon)" } : { color: "var(--muted)" },
                )}
                hover={active ? "" : "color:var(--ink);background:var(--putty)"}
              >
                {t.label}
                {typeof t.count === "number" && (
                  <span
                    style={sx(
                      "min-width:19px;height:19px;padding:0 5px;border-radius:10px;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center",
                      active
                        ? { background: "var(--maroon)", color: "#fff" }
                        : { background: "var(--putty)", color: "var(--muted)" },
                    )}
                  >
                    {t.count}
                  </span>
                )}
                {active && (
                  <span style={css("position:absolute;left:8px;right:8px;bottom:-3px;height:3px;border-radius:3px;background:var(--maroon)")} />
                )}
              </Hoverable>
            );
          })}
        </div>

        {/* Panels */}
        {tab === "purchases" && <PurchasesPanel />}
        {tab === "offers" && <OffersPanel />}
        {tab === "saved" && <SavedPanel />}
        {tab === "payments" && <PaymentsPanel />}
        {tab === "addresses" && <AddressesPanel />}
        {tab === "settings" && <SettingsPanel />}
      </div>
    </div>
  );
}

/* =============================== Profile header =============================== */
function ProfileHeader() {
  const spent = PURCHASES.reduce((sum, p) => sum + p.priceCents, 0);
  const stats: [string, string][] = [
    [String(PURCHASES.length), "Purchases"],
    [String(SAVED_ITEMS.length), "Saved"],
    [`${PROFILE.rating.toFixed(1)} ★`, `${PROFILE.reviewCount} reviews`],
    [formatPrice(spent), "Lifetime spend"],
  ];
  return (
    <div style={css("background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:20px 22px;box-shadow:0 3px 10px rgba(60,10,35,.05)")}>
      <div style={css("display:flex;align-items:center;gap:18px;flex-wrap:wrap")}>
        <span style={css("width:74px;height:74px;flex:0 0 auto;border-radius:50%;background:var(--blueInk);color:#fff;display:flex;align-items:center;justify-content:center;font-family:'Newsreader',serif;font-size:32px;font-weight:600;box-shadow:0 6px 16px rgba(44,91,138,.28)")}>
          {PROFILE.initial}
        </span>
        <div style={css("flex:1;min-width:180px")}>
          <div style={css("display:flex;align-items:center;gap:10px;flex-wrap:wrap")}>
            <h1 style={css("font-family:'Newsreader',serif;font-size:28px;font-weight:600;letter-spacing:-.4px;line-height:1.1")}>{PROFILE.name}</h1>
            {PROFILE.verified && (
              <span style={css("display:inline-flex;align-items:center;gap:5px;background:var(--greenBg);color:var(--green);font-size:12px;font-weight:800;padding:5px 11px;border-radius:20px")}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                Verified
              </span>
            )}
          </div>
          <div style={css("display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:6px;color:var(--muted);font-size:13.5px")}>
            <span style={css("display:flex;align-items:center;gap:5px")}><Pin size={14} stroke="var(--maroon)" />{PROFILE.city}</span>
            <span style={css("width:4px;height:4px;border-radius:50%;background:var(--line)")} />
            <span>Member since {PROFILE.memberSince}</span>
          </div>
        </div>
        <Hoverable
          styles="border:1px solid var(--line);background:var(--paper);color:var(--ink);border-radius:10px;padding:10px 16px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap"
          hover="box-shadow:0 6px 16px rgba(60,10,35,.1);border-color:#d9b7c2"
        >
          Edit profile
        </Hoverable>
      </div>
      <div style={css("display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:20px")}>
        {stats.map(([n, l]) => (
          <div key={l} style={css("background:var(--cream);border:1px solid var(--line);border-radius:12px;padding:13px 14px")}>
            <div style={css("font-size:20px;font-weight:800;letter-spacing:-.4px")}>{n}</div>
            <div style={css("font-size:12px;color:var(--muted);margin-top:1px")}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =============================== Shared bits =============================== */
function Thumb({ tint, size = 62, radius = 10 }: { tint: Tint; size?: number; radius?: number }) {
  return (
    <div
      style={sx(
        "flex:0 0 auto",
        {
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: `${radius}px`,
          background: `repeating-linear-gradient(135deg,${tint[0]} 0 10px,${tint[1]} 10px 20px)`,
        },
      )}
    />
  );
}

function StatusPill({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span style={sx("font-size:12px;font-weight:800;padding:5px 12px;border-radius:20px;white-space:nowrap", { background: bg, color })}>
      {label}
    </span>
  );
}

function PanelHead({ title, sub, children }: { title: string; sub: string; children?: React.ReactNode }) {
  return (
    <div style={css("display:flex;align-items:flex-end;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:16px")}>
      <div>
        <h2 style={css("font-family:'Newsreader',serif;font-size:24px;font-weight:600;letter-spacing:-.3px")}>{title}</h2>
        <p style={css("color:var(--muted);font-size:13.5px;margin-top:2px")}>{sub}</p>
      </div>
      {children}
    </div>
  );
}

function EmptyState({ title, text, cta, onCta }: { title: string; text: string; cta?: string; onCta?: () => void }) {
  return (
    <div style={css("text-align:center;padding:60px 20px;background:var(--paper);border:1px solid var(--line);border-radius:14px")}>
      <div style={css("width:52px;height:52px;margin:0 auto 12px;border-radius:50%;background:var(--putty);display:flex;align-items:center;justify-content:center")}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M4 9h16l-1-4.5H5L4 9Z" /><path d="M5 9v10.5h14V9" /></svg>
      </div>
      <div style={css("font-family:'Newsreader',serif;font-size:20px;color:var(--ink);margin-bottom:5px")}>{title}</div>
      <div style={css("font-size:14px;color:var(--muted);max-width:360px;margin:0 auto")}>{text}</div>
      {cta && (
        <button onClick={onCta} style={css("margin-top:16px;background:var(--maroon);color:#fff;border:none;border-radius:10px;padding:11px 20px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit")}>
          {cta}
        </button>
      )}
    </div>
  );
}

function LinkButton({ label, onClick, tone = "blue" }: { label: string; onClick?: () => void; tone?: "blue" | "muted" | "red" }) {
  const color = tone === "red" ? "var(--red)" : tone === "muted" ? "var(--muted)" : "var(--blueInk)";
  return (
    <Hoverable as="span" onClick={onClick} styles={sx("font-size:12.5px;font-weight:700;cursor:pointer", { color })} hover="text-decoration:underline">
      {label}
    </Hoverable>
  );
}

/* =============================== Purchases =============================== */
function purchaseTone(s: PurchaseStatus): { bg: string; color: string } {
  switch (s) {
    case "Delivered":
      return { bg: "var(--greenBg)", color: "var(--green)" };
    case "In transit":
      return { bg: "var(--blueBg)", color: "var(--blueInk)" };
    case "Scheduled":
      return { bg: "var(--yellowBg)", color: "var(--gold)" };
    default:
      return { bg: "var(--putty)", color: "var(--muted)" };
  }
}

function PurchasesPanel() {
  const items: Purchase[] = PURCHASES;
  const delivered = items.filter((p) => p.status === "Delivered").length;
  const active = items.length - delivered;

  if (items.length === 0) {
    return <EmptyState title="No purchases yet" text="Items you buy on Commonplace show up here — with live delivery tracking." cta="Start browsing" />;
  }
  return (
    <div>
      <PanelHead title="Your purchases" sub="Every order, with live delivery status and receipts." />
      <div style={css("display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px")}>
        {([["Total orders", String(items.length), "var(--ink)"], ["Arriving soon", String(active), "var(--blueInk)"], ["Delivered", String(delivered), "var(--green)"]] as const).map(([l, n, c]) => (
          <div key={l} style={css("background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:14px 16px")}>
            <div style={sx("font-size:24px;font-weight:800;letter-spacing:-.5px", { color: c })}>{n}</div>
            <div style={css("font-size:12.5px;color:var(--muted)")}>{l}</div>
          </div>
        ))}
      </div>
      <div style={css("display:flex;flex-direction:column;gap:11px")}>
        {items.map((p) => {
          const tone = purchaseTone(p.status);
          return (
            <div key={p.id} style={css("display:flex;align-items:center;gap:14px;background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:13px 15px")}>
              <Thumb tint={p.tint} />
              <div style={css("flex:1;min-width:0")}>
                <div style={css("font-size:14.5px;font-weight:600;line-height:1.3;text-wrap:pretty")}>{p.title}</div>
                <div style={css("font-size:12.5px;color:var(--muted);margin-top:3px")}>
                  Order {p.orderNo} · {p.date} · <b style={css("color:var(--ink)")}>{formatPrice(p.priceCents)}</b>
                </div>
                {p.eta && (
                  <div style={css("display:flex;align-items:center;gap:5px;font-size:12px;color:var(--blueInk);font-weight:600;margin-top:4px")}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="1" y="6" width="14" height="10" rx="1.5" /><path d="M15 9h4l3 3.5V16h-7z" /><circle cx="6" cy="17.5" r="1.8" /><circle cx="18" cy="17.5" r="1.8" /></svg>
                    {p.eta}
                  </div>
                )}
              </div>
              <div style={css("display:flex;flex-direction:column;align-items:flex-end;gap:8px")}>
                <StatusPill label={p.status} bg={tone.bg} color={tone.color} />
                {p.status === "Delivered" ? (
                  <LinkButton label={p.canReview ? "Leave a review" : "View receipt"} />
                ) : (
                  <LinkButton label="Track order" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* =============================== Offers =============================== */
function offerTone(s: OfferStatus): { bg: string; color: string } {
  switch (s) {
    case "Accepted":
      return { bg: "var(--greenBg)", color: "var(--green)" };
    case "Countered":
      return { bg: "var(--yellowBg)", color: "var(--gold)" };
    case "Pending":
      return { bg: "var(--blueBg)", color: "var(--blueInk)" };
    default:
      return { bg: "#F1E7E4", color: "var(--red)" };
  }
}

function OffersPanel() {
  const items: Offer[] = OFFERS;
  const active = items.filter((o) => o.status === "Countered" || o.status === "Pending").length;
  const accepted = items.filter((o) => o.status === "Accepted").length;

  if (items.length === 0) {
    return <EmptyState title="No active offers" text="When you make an offer, we negotiate on your behalf and track every counter here." cta="Browse items" />;
  }
  return (
    <div>
      <PanelHead title="Your offers" sub="We negotiate up from your price — you only act on counters and acceptances." />
      <div style={css("display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px")}>
        {([["Open offers", String(active), "var(--ink)"], ["Accepted", String(accepted), "var(--green)"], ["Total placed", String(items.length), "var(--ink)"]] as const).map(([l, n, c]) => (
          <div key={l} style={css("background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:14px 16px")}>
            <div style={sx("font-size:24px;font-weight:800;letter-spacing:-.5px", { color: c })}>{n}</div>
            <div style={css("font-size:12.5px;color:var(--muted)")}>{l}</div>
          </div>
        ))}
      </div>
      <div style={css("display:flex;flex-direction:column;gap:11px")}>
        {items.map((o) => {
          const tone = offerTone(o.status);
          return (
            <div key={o.id} style={css("display:flex;align-items:center;gap:14px;background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:13px 15px")}>
              <Thumb tint={o.tint} />
              <div style={css("flex:1;min-width:0")}>
                <div style={css("font-size:14.5px;font-weight:600;line-height:1.3;text-wrap:pretty")}>{o.title}</div>
                <div style={css("font-size:12.5px;color:var(--muted);margin-top:3px")}>
                  Your offer <b style={css("color:var(--ink)")}>{formatPrice(o.offerCents)}</b> · list {formatPrice(o.listCents)} · {o.when}
                </div>
              </div>
              <div style={css("display:flex;flex-direction:column;align-items:flex-end;gap:8px")}>
                <StatusPill label={o.status} bg={tone.bg} color={tone.color} />
                {o.action && <LinkButton label={o.action} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* =============================== Saved / Wishlist =============================== */
function SavedPanel() {
  const [items, setItems] = useState<SavedItem[]>(SAVED_ITEMS);
  const remove = (id: string) => setItems((prev) => prev.filter((x) => x.id !== id));

  if (items.length === 0) {
    return <EmptyState title="Nothing saved yet" text="Tap the heart on any listing to save it here and get alerted on price drops." cta="Find something you love" />;
  }
  return (
    <div>
      <PanelHead title="Saved items" sub="Your wishlist — we'll ping you when any of these drop in price." />
      <div style={css("display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px")}>
        {items.map((it) => (
          <div key={it.id} style={css("position:relative;background:var(--paper);border:1px solid var(--line);border-radius:12px;overflow:hidden;box-shadow:0 3px 10px rgba(60,10,35,.05)")}>
            <div style={sx("position:relative;aspect-ratio:4/3", { background: `repeating-linear-gradient(135deg,${it.tint[0]} 0 15px,${it.tint[1]} 15px 30px)` })}>
              <div style={css("position:absolute;top:9px;left:9px;background:rgba(255,255,255,.95);color:var(--ink);padding:3px 8px;border-radius:20px;font-size:10px;font-weight:700;box-shadow:0 1px 4px rgba(0,0,0,.1)")}>{it.condition}</div>
              {it.savingsPct ? (
                <div style={css("position:absolute;top:9px;right:9px;background:var(--green);color:#fff;padding:3px 8px;border-radius:20px;font-size:10px;font-weight:800")}>Save {it.savingsPct}%</div>
              ) : null}
              <Hoverable
                as="button"
                onClick={() => remove(it.id)}
                title="Remove from saved"
                styles="position:absolute;bottom:9px;right:9px;width:32px;height:32px;border-radius:50%;border:none;background:rgba(255,255,255,.95);display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.14)"
                hover="filter:brightness(.95)"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="var(--maroon)" stroke="var(--maroon)" strokeWidth={2}><path d="M12 21s-7-4.35-9.5-8.5C1 9 2.5 5.5 6 5.5c2 0 3.2 1.2 4 2.3.8-1.1 2-2.3 4-2.3 3.5 0 5 3.5 3.5 7-2.5 4.15-9.5 8.5-9.5 8.5Z" /></svg>
              </Hoverable>
            </div>
            <div style={css("padding:10px 11px 12px")}>
              <div style={css("font-family:'Newsreader',serif;font-size:13.5px;font-weight:500;line-height:1.28;height:35px;overflow:hidden;text-wrap:pretty")}>{it.title}</div>
              <div style={css("display:flex;align-items:center;gap:4px;font-size:10.5px;color:var(--muted);margin-top:6px")}>
                <Pin size={12} />{it.location}
              </div>
              <div style={css("display:flex;align-items:baseline;gap:7px;margin-top:5px")}>
                <span style={css("font-size:15px;font-weight:800;letter-spacing:-.3px")}>{formatPrice(it.priceCents)}</span>
                {it.retailCents ? <span style={css("font-size:11px;color:var(--muted);text-decoration:line-through")}>{formatPrice(it.retailCents)}</span> : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =============================== Payment methods =============================== */
function PaymentsPanel() {
  const [methods, setMethods] = useState<PaymentMethod[]>(PAYMENT_METHODS);
  const makeDefault = (id: string) => setMethods((prev) => prev.map((m) => ({ ...m, isDefault: m.id === id })));
  const remove = (id: string) =>
    setMethods((prev) => {
      const next = prev.filter((m) => m.id !== id);
      // Never leave the list without a default.
      if (next.length && !next.some((m) => m.isDefault)) next[0] = { ...next[0], isDefault: true };
      return next;
    });

  return (
    <div>
      <PanelHead title="Payment methods" sub="Used for your $1 reservation and the balance charged at delivery.">
        <Hoverable
          as="button"
          styles="display:flex;align-items:center;gap:7px;background:var(--blueInk);color:#fff;border:none;border-radius:10px;padding:10px 16px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit"
          hover="filter:brightness(1.06)"
        >
          <Plus size={16} />Add card
        </Hoverable>
      </PanelHead>

      {methods.length === 0 ? (
        <EmptyState title="No payment methods" text="Add a card to reserve items with $1 and check out at delivery." cta="Add a card" />
      ) : (
        <div style={css("display:flex;flex-direction:column;gap:11px")}>
          {methods.map((m) => {
            const brand = BRAND_STYLE[m.brand];
            return (
              <div key={m.id} style={css("display:flex;align-items:center;gap:14px;background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:14px 15px")}>
                <div style={sx("width:52px;height:34px;flex:0 0 auto;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;letter-spacing:.02em", { background: brand.bg, color: brand.fg })}>
                  {m.brand === "Mastercard" ? "MC" : m.brand === "Amex" ? "AMEX" : m.brand.toUpperCase()}
                </div>
                <div style={css("flex:1;min-width:0")}>
                  <div style={css("display:flex;align-items:center;gap:9px;flex-wrap:wrap")}>
                    <span style={css("font-size:14.5px;font-weight:700")}>{m.brand} •••• {m.last4}</span>
                    {m.isDefault && (
                      <span style={css("font-size:11px;font-weight:800;color:var(--green);background:var(--greenBg);padding:3px 9px;border-radius:20px")}>Default</span>
                    )}
                  </div>
                  <div style={css("font-size:12.5px;color:var(--muted);margin-top:2px")}>{m.holder} · Expires {m.expiry}</div>
                </div>
                <div style={css("display:flex;align-items:center;gap:14px")}>
                  {!m.isDefault && <LinkButton label="Set default" onClick={() => makeDefault(m.id)} />}
                  <LinkButton label="Remove" tone="red" onClick={() => remove(m.id)} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* =============================== Addresses =============================== */
function AddressesPanel() {
  const [addresses, setAddresses] = useState<Address[]>(ADDRESSES);
  const makeDefault = (id: string) => setAddresses((prev) => prev.map((a) => ({ ...a, isDefault: a.id === id })));
  const remove = (id: string) =>
    setAddresses((prev) => {
      const next = prev.filter((a) => a.id !== id);
      if (next.length && !next.some((a) => a.isDefault)) next[0] = { ...next[0], isDefault: true };
      return next;
    });

  return (
    <div>
      <PanelHead title="Delivery addresses" sub="Where we bring and set up your items.">
        <Hoverable
          as="button"
          styles="display:flex;align-items:center;gap:7px;background:var(--blueInk);color:#fff;border:none;border-radius:10px;padding:10px 16px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit"
          hover="filter:brightness(1.06)"
        >
          <Plus size={16} />Add address
        </Hoverable>
      </PanelHead>

      {addresses.length === 0 ? (
        <EmptyState title="No addresses saved" text="Add a delivery address so we know where to bring your orders." cta="Add an address" />
      ) : (
        <div style={css("display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px")}>
          {addresses.map((a) => (
            <div key={a.id} style={css("background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:16px")}>
              <div style={css("display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px")}>
                <div style={css("display:flex;align-items:center;gap:8px")}>
                  <span style={css("width:28px;height:28px;border-radius:8px;flex:0 0 auto;background:var(--tint);color:var(--maroon);display:flex;align-items:center;justify-content:center")}><Pin size={15} stroke="var(--maroon)" /></span>
                  <span style={css("font-size:14px;font-weight:800")}>{a.label}</span>
                </div>
                {a.isDefault && (
                  <span style={css("font-size:11px;font-weight:800;color:var(--green);background:var(--greenBg);padding:3px 9px;border-radius:20px")}>Default</span>
                )}
              </div>
              <div style={css("font-size:13.5px;line-height:1.5;color:var(--ink)")}>
                <div style={css("font-weight:600")}>{a.name}</div>
                <div style={css("color:var(--muted)")}>{a.line1}</div>
                {a.line2 && <div style={css("color:var(--muted)")}>{a.line2}</div>}
                <div style={css("color:var(--muted)")}>{a.cityStateZip}</div>
              </div>
              <div style={css("display:flex;align-items:center;gap:16px;margin-top:12px;padding-top:12px;border-top:1px solid var(--line)")}>
                <LinkButton label="Edit" />
                {!a.isDefault && <LinkButton label="Set default" onClick={() => makeDefault(a.id)} />}
                {!a.isDefault && <LinkButton label="Remove" tone="red" onClick={() => remove(a.id)} />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* =============================== Settings =============================== */
function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={on}
      style={sx(
        "position:relative;width:44px;height:26px;flex:0 0 auto;border:none;border-radius:20px;cursor:pointer;transition:background .18s",
        { background: on ? "var(--green)" : "#d8cfc2" },
      )}
    >
      <span
        style={sx(
          "position:absolute;top:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:left .18s",
          { left: on ? "21px" : "3px" },
        )}
      />
    </button>
  );
}

function SettingsPanel() {
  const [profile, setProfile] = useState({ name: PROFILE.name, email: PROFILE.email, phone: PROFILE.phone });
  const [notifs, setNotifs] = useState<NotificationSetting[]>(NOTIFICATION_SETTINGS);
  const toggle = (key: string) => setNotifs((prev) => prev.map((n) => (n.key === key ? { ...n, enabled: !n.enabled } : n)));

  const fieldStyle = "width:100%;border:1px solid var(--line);background:var(--paper);border-radius:10px;padding:11px 12px;font-size:14px;color:var(--ink);outline:none;font-family:inherit";

  return (
    <div style={css("max-width:720px")}>
      <PanelHead title="Settings" sub="Manage your details, notifications, and account." />

      {/* Personal details */}
      <div style={css("background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:18px;margin-bottom:16px")}>
        <div style={css("font-size:16px;font-weight:800;margin-bottom:14px")}>Personal details</div>
        <div style={css("display:flex;flex-direction:column;gap:13px")}>
          <div>
            <div style={css("font-size:12.5px;font-weight:700;margin-bottom:6px")}>Full name</div>
            <input value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} style={css(fieldStyle)} />
          </div>
          <div style={css("display:flex;gap:12px;flex-wrap:wrap")}>
            <div style={css("flex:1;min-width:200px")}>
              <div style={css("font-size:12.5px;font-weight:700;margin-bottom:6px")}>Email</div>
              <input value={profile.email} type="email" onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))} style={css(fieldStyle)} />
            </div>
            <div style={css("flex:1;min-width:200px")}>
              <div style={css("font-size:12.5px;font-weight:700;margin-bottom:6px")}>Phone</div>
              <input value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} style={css(fieldStyle)} />
            </div>
          </div>
          <div style={css("display:flex;justify-content:flex-end")}>
            <button style={css("background:var(--maroon);color:#fff;border:none;border-radius:10px;padding:10px 20px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit")}>Save changes</button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div style={css("background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:18px;margin-bottom:16px")}>
        <div style={css("font-size:16px;font-weight:800;margin-bottom:6px")}>Notifications</div>
        <div style={css("display:flex;flex-direction:column")}>
          {notifs.map((n, i) => (
            <div key={n.key} style={sx("display:flex;align-items:center;gap:14px;padding:13px 0", i > 0 ? "border-top:1px solid var(--line)" : "")}>
              <div style={css("flex:1;min-width:0")}>
                <div style={css("font-size:14px;font-weight:700")}>{n.label}</div>
                <div style={css("font-size:12.5px;color:var(--muted);margin-top:1px")}>{n.desc}</div>
              </div>
              <Toggle on={n.enabled} onToggle={() => toggle(n.key)} />
            </div>
          ))}
        </div>
      </div>

      {/* Account actions */}
      <div style={css("background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:18px")}>
        <div style={css("font-size:16px;font-weight:800;margin-bottom:12px")}>Account</div>
        <div style={css("display:flex;gap:10px;flex-wrap:wrap")}>
          <button style={css("border:1px solid var(--line);background:var(--paper);color:var(--ink);border-radius:10px;padding:10px 18px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit")}>Sign out</button>
          <Hoverable
            as="button"
            styles="display:inline-flex;align-items:center;gap:7px;border:1px solid var(--red);background:var(--paper);color:var(--red);border-radius:10px;padding:10px 18px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit"
            hover="background:#F1E7E4"
          >
            <Close size={14} stroke="var(--red)" />Delete account
          </Hoverable>
        </div>
      </div>
    </div>
  );
}
