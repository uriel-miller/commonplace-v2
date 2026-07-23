"use client";

import { useEffect, useState } from "react";
import { css, sx, Hoverable } from "@/lib/design/css";
import { formatPrice } from "@/lib/listing";
import type { OrderRecord, OrderStatus } from "@/lib/orders";
import type { OfferDTO, OfferStatus } from "@/lib/offers";

// Client-safe status labels (importing the value from @/lib/orders would pull
// the server-only Prisma client into the client bundle).
const STATUS_LABEL: Record<string, string> = {
  reserved: "Reserved", scheduled: "Scheduled", picked_up: "Picked up",
  in_transit: "In transit", delivered: "Delivered", paid: "Paid", cancelled: "Cancelled",
};
import { Pin, Plus, ChevronLeft } from "@/components/marketplace/icons";
import {
  CUSTOMER,
  ADDRESSES,
  SAVED_CARDS,
  LISTINGS_FALLBACK,
  CARD_BRAND_STYLE,
  LISTING_STATUS_STYLE,
  type SavedCard,
  type AddressCard,
  type ListingRow,
} from "./accountFixtures";

// Root CSS custom properties, ported verbatim from the design wrapper so the
// page renders correctly whether it's mounted standalone or inside the shell
// (re-declaring the same variables on a nested wrapper is harmless).
const ROOT_VARS =
  "--cream:#FBF8F4;--paper:#ffffff;--ink:#19171C;--muted:#7C7069;--line:#ECE4D8;--maroon:#620E3B;--maroon2:#7A2740;--tint:#F4E7EA;--putty:#f6f1ea;--gold:#C98A22;--blue:#7FA8D9;--purple:#9C88D6;--yellow:#E7C24B;--red:#C15540;--green:#3B7A57;--greenBg:#E1F0E7;--blueBg:#E4EDF8;--blueInk:#2C5B8A";

/* ------------------------------------------------------------------ */
/* Nav model                                                          */
/* ------------------------------------------------------------------ */

type TabKey =
  | "dashboard"
  | "orders"
  | "wishlist"
  | "listings"
  | "offers"
  | "personal-details"
  | "referral";

const NAV: { key: TabKey; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "orders", label: "Orders" },
  { key: "wishlist", label: "Wishlist" },
  { key: "listings", label: "Listings" },
  { key: "offers", label: "Offers" },
  { key: "personal-details", label: "Personal Details" },
  { key: "referral", label: "Refferal" },
];

export interface AccountPageProps {
  /** Optional "back to browse" affordance used by the shell. */
  onBack?: () => void;
}

/* ------------------------------------------------------------------ */
/* Shared helpers                                                     */
/* ------------------------------------------------------------------ */

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div style={css("background:var(--blueBg);color:var(--blueInk);border-radius:10px;padding:13px 16px;font-size:14px;line-height:1.5;margin-bottom:22px")}>
      {children}
    </div>
  );
}

function PageHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={css("font-family:'Reckless','Newsreader',serif;font-size:22px;font-weight:600;letter-spacing:-.3px;color:var(--ink);margin-bottom:16px")}>
      {children}
    </h2>
  );
}

function PrimaryButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <Hoverable
      as="button"
      onClick={onClick}
      styles="display:inline-flex;align-items:center;gap:7px;background:var(--maroon);color:#fff;border:none;border-radius:10px;padding:11px 20px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap"
      hover="filter:brightness(1.08)"
    >
      {children}
    </Hoverable>
  );
}

function GhostButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <Hoverable
      as="button"
      onClick={onClick}
      styles="display:inline-flex;align-items:center;gap:7px;background:var(--paper);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:9px 15px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap"
      hover="border-color:#d9b7c2;box-shadow:0 4px 12px rgba(60,10,35,.08)"
    >
      {children}
    </Hoverable>
  );
}

function LinkA({ label, onClick, tone = "blue" }: { label: string; onClick?: () => void; tone?: "blue" | "red" | "muted" }) {
  const color = tone === "red" ? "var(--red)" : tone === "muted" ? "var(--muted)" : "var(--blueInk)";
  return (
    <Hoverable
      as="span"
      onClick={onClick}
      styles={sx("font-size:13px;font-weight:700;cursor:pointer", { color })}
      hover="text-decoration:underline"
    >
      {label}
    </Hoverable>
  );
}

function EmptyState({ title, text, cta, onCta }: { title: string; text: string; cta?: string; onCta?: () => void }) {
  return (
    <div style={css("text-align:center;padding:52px 22px;background:var(--paper);border:1px solid var(--line);border-radius:14px")}>
      <div style={css("width:50px;height:50px;margin:0 auto 14px;border-radius:50%;background:var(--putty);display:flex;align-items:center;justify-content:center")}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M4 9h16l-1-4.5H5L4 9Z" /><path d="M5 9v10.5h14V9" /></svg>
      </div>
      <div style={css("font-family:'Reckless','Newsreader',serif;font-size:19px;color:var(--ink);margin-bottom:6px")}>{title}</div>
      <div style={css("font-size:14px;color:var(--muted);max-width:380px;margin:0 auto 16px")}>{text}</div>
      {cta && <PrimaryButton onClick={onCta}>{cta}</PrimaryButton>}
    </div>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div style={css("display:flex;align-items:center;justify-content:center;gap:11px;padding:56px 20px;color:var(--muted);font-size:14px")}>
      <span
        style={css("width:18px;height:18px;border-radius:50%;border:2.5px solid var(--line);border-top-color:var(--maroon);display:inline-block;animation:cp-acct-spin .7s linear infinite")}
      />
      {label}
    </div>
  );
}

function StatusBadge({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span style={sx("display:inline-block;font-size:12px;font-weight:800;padding:4px 11px;border-radius:20px;white-space:nowrap", { background: bg, color })}>
      {label}
    </span>
  );
}

/** Small placeholder tile for rows/cards missing a real remote image. */
function Thumb({ src, size = 46 }: { src: string | null; size?: number }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        loading="lazy"
        style={sx("flex:0 0 auto;object-fit:cover;border-radius:8px;border:1px solid var(--line)", { width: `${size}px`, height: `${size}px` })}
      />
    );
  }
  return (
    <div
      style={sx("flex:0 0 auto;border-radius:8px;border:1px solid var(--line);background:repeating-linear-gradient(135deg,#EDE4D6 0 8px,#E5DACA 8px 16px)", { width: `${size}px`, height: `${size}px` })}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export function AccountPage({ onBack }: AccountPageProps = {}) {
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [loggedOut, setLoggedOut] = useState(false);

  return (
    <div
      style={sx(
        ROOT_VARS,
        "font-family:'Roobert','Inter Tight',system-ui,-apple-system,'Helvetica Neue',sans-serif;color:var(--ink);min-height:100dvh;width:100%;background:var(--cream);overflow-y:auto",
      )}
    >
      {/* Keyframes for the loading spinner (scoped by unique animation name). */}
      <style>{"@keyframes cp-acct-spin{to{transform:rotate(360deg)}}"}</style>

      {/* Welcome hero + horizontal tabs (matches the live /account/ dashboard) */}
      <div style={css("background:var(--cream)")}>
        <div style={css("max-width:1160px;margin:0 auto;padding:18px 24px 0")}>
          <div style={css("display:flex;align-items:center;gap:7px;font-size:12.5px;color:var(--muted);margin-bottom:26px")}>
            {onBack ? <span onClick={onBack} style={css("cursor:pointer")}>Home</span> : <span>Home</span>}
            <span>/</span>
            <span style={css("color:var(--ink)")}>{NAV.find((n) => n.key === tab)?.label ?? "Dashboard"}</span>
          </div>
          <h1 style={css("font-family:'Reckless','Newsreader',serif;font-size:clamp(30px,4.5vw,44px);font-weight:500;letter-spacing:-.5px;line-height:1.05;margin-bottom:26px")}>
            Welcome, {CUSTOMER.firstName}!
          </h1>
          <div style={css("display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;border-bottom:1px solid var(--line)")}>
            <div style={css("display:flex;gap:28px;flex-wrap:wrap")}>
              {NAV.map((item) => {
                const active = tab === item.key;
                return (
                  <Hoverable key={item.key} as="span" aria-current={active ? "page" : undefined} onClick={() => setTab(item.key)}
                    styles={sx("padding:0 0 13px;font-size:15px;font-weight:600;cursor:pointer;white-space:nowrap;border-bottom:2px solid transparent;margin-bottom:-1px", active ? { color: "var(--maroon)", borderBottomColor: "var(--maroon)" } : { color: "var(--muted)" })}
                    hover={active ? "" : "color:var(--ink)"}>{item.label}</Hoverable>
                );
              })}
            </div>
            <Hoverable as="span" onClick={() => setLoggedOut(true)} styles="padding-bottom:13px;font-size:14px;font-weight:600;color:var(--ink);text-decoration:underline;cursor:pointer" hover="color:var(--maroon)">Logout</Hoverable>
          </div>
        </div>
      </div>

      {/* Active tab content */}
      <div style={css("max-width:1160px;margin:0 auto;padding:30px 24px 72px")}>
        {loggedOut ? (
          <LoggedOut onBack={onBack} onBackIn={() => { setLoggedOut(false); setTab("dashboard"); }} />
        ) : (
          <>
            {tab === "dashboard" && <DashboardPanel onNavigate={setTab} onBrowse={onBack} />}
            {tab === "orders" && <OrdersPanel onBrowse={onBack} />}
            {tab === "wishlist" && <WishlistPanel onBrowse={onBack} />}
            {tab === "listings" && <MyListingsPanel onBrowse={onBack} />}
            {tab === "offers" && <CounterOffersPanel onBrowse={onBack} />}
            {tab === "personal-details" && (
              <div style={css("display:flex;flex-direction:column;gap:24px")}>
                <AccountDetailsPanel />
                <AddressesPanel />
                <PaymentMethodsPanel />
              </div>
            )}
            {tab === "referral" && <ReferralPanel />}
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Logged-out view                                                    */
/* ------------------------------------------------------------------ */

function LoggedOut({ onBack, onBackIn }: { onBack?: () => void; onBackIn: () => void }) {
  return (
    <div style={css("text-align:center;padding:56px 22px;background:var(--paper);border:1px solid var(--line);border-radius:16px;max-width:520px;margin:0 auto")}>
      <div style={css("font-family:'Reckless','Newsreader',serif;font-size:24px;color:var(--ink);margin-bottom:8px")}>You are now logged out</div>
      <div style={css("font-size:14px;color:var(--muted);margin-bottom:20px")}>Thanks for stopping by. See you again soon.</div>
      <div style={css("display:flex;gap:10px;justify-content:center;flex-wrap:wrap")}>
        {onBack && <PrimaryButton onClick={onBack}>Return to browsing</PrimaryButton>}
        <GhostButton onClick={onBackIn}>Log back in</GhostButton>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                          */
/* ------------------------------------------------------------------ */

const WHATS_NEW: { title: string; bg: string; fg: string }[] = [
  { title: "Latest Pelotons", bg: "#F1DB75", fg: "#5a4a12" },
  { title: "Home Gyms", bg: "#F9AEB7", fg: "#7a2233" },
  { title: "Hot Tubs", bg: "#D4C3FF", fg: "#3d2a72" },
];

function DashboardPanel({ onNavigate, onBrowse }: { onNavigate: (t: TabKey) => void; onBrowse?: () => void }) {
  const [orders, setOrders] = useState<OrderRecord[] | null>(null);
  const [offers, setOffers] = useState<OfferDTO[] | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/orders?limit=8", { signal: ctrl.signal });
        const d: unknown = await res.json();
        setOrders(d && typeof d === "object" && Array.isArray((d as { orders?: unknown }).orders) ? (d as { orders: OrderRecord[] }).orders : []);
      } catch (e) { if ((e as { name?: string })?.name !== "AbortError") setOrders([]); }
    })();
    (async () => {
      try {
        const res = await fetch("/api/offers?role=buyer", { signal: ctrl.signal });
        const d: unknown = await res.json();
        setOffers(d && typeof d === "object" && Array.isArray((d as { offers?: unknown }).offers) ? (d as { offers: OfferDTO[] }).offers : []);
      } catch (e) { if ((e as { name?: string })?.name !== "AbortError") setOffers([]); }
    })();
    return () => ctrl.abort();
  }, []);

  const pending = (offers ?? []).filter((o) => o.status === "accepted");

  return (
    <div style={css("display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:36px;align-items:start")} data-acct-grid>
      {/* LEFT */}
      <div>
        {/* Pending */}
        <h2 style={css("font-family:'Reckless','Newsreader',serif;font-size:22px;font-weight:600;margin-bottom:16px")}>Pending ( {pending.length} )</h2>
        {offers === null ? (
          <Loading label="Loading…" />
        ) : pending.length === 0 ? (
          <div style={css("font-size:14px;color:var(--muted);margin-bottom:8px")}>No accepted offers waiting. When a seller accepts your offer, it lands here to check out.</div>
        ) : (
          pending.map((o) => {
            const price = o.counterCents ?? o.amountCents;
            return (
              <div key={o.id} style={css("display:flex;gap:16px;background:var(--greenBg);border-radius:16px;padding:14px;margin-bottom:16px;flex-wrap:wrap;align-items:center")}>
                <div style={css("width:150px;height:110px;flex:0 0 auto;border-radius:10px;overflow:hidden;background:var(--putty)")}>
                  {o.listingImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={o.listingImage} alt="" style={css("width:100%;height:100%;object-fit:cover")} />
                  ) : null}
                </div>
                <div style={css("flex:1;min-width:180px")}>
                  <StatusBadge label="Accepted" bg="#F1DB75" color="#5a4a12" />
                  <div style={css("font-size:15px;font-weight:700;margin:8px 0 4px")}>Your offer was accepted ›</div>
                  <div style={css("font-size:20px;font-weight:800")}>{formatPrice(price)} <span style={css("font-size:14px;color:var(--muted);text-decoration:line-through;font-weight:500")}>{formatPrice(o.listPriceCents)}</span></div>
                  <div style={css("font-size:12px;color:var(--muted);margin:4px 0 12px")}>Listing ID: {o.id}</div>
                  <Hoverable as="button" onClick={onBrowse} styles="width:100%;background:var(--maroon);color:#fff;border:none;border-radius:10px;padding:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit" hover="filter:brightness(1.08)">Checkout</Hoverable>
                </div>
              </div>
            );
          })
        )}

        {/* Payment Status */}
        <div style={css("display:flex;align-items:center;justify-content:space-between;margin:28px 0 16px")}>
          <h2 style={css("font-family:'Reckless','Newsreader',serif;font-size:22px;font-weight:600")}>Payment Status</h2>
          <LinkA label="View all" onClick={() => onNavigate("orders")} />
        </div>
        {orders === null ? (
          <Loading label="Loading your orders…" />
        ) : orders.length === 0 ? (
          <EmptyState title="No orders yet" text="Reserve something for $1 and it shows here with live status." cta="Browse products" onCta={onBrowse} />
        ) : (
          orders.map((o) => {
            const tone = ORDER_TONE[o.status] ?? ORDER_TONE.reserved;
            const cancelled = o.status === "cancelled";
            const done = o.status === "delivered" || o.status === "paid";
            return (
              <div key={o.id} style={css("background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin-bottom:12px")}>
                <div style={css("display:flex;align-items:center;justify-content:space-between;gap:10px")}>
                  <span style={css("font-size:15px;font-weight:700")}>Order #{o.id}</span>
                  <span style={css("font-size:12.5px;color:var(--muted)")}>{fmtDate(o.createdAt)}</span>
                </div>
                <div style={css("display:flex;align-items:center;gap:10px;margin-top:10px")}>
                  <StatusBadge label={STATUS_LABEL[o.status] ?? o.status} bg={tone.bg} color={tone.color} />
                  <span style={css("font-size:13.5px;color:var(--ink)")}><b>{formatPrice(o.priceCents)}</b></span>
                </div>
                <div style={css("height:5px;border-radius:3px;margin-top:12px;overflow:hidden;background:var(--line)")}>
                  <div style={sx("height:100%;border-radius:3px", cancelled ? { width: "100%", background: "var(--red)" } : { width: done ? "100%" : "55%", background: "var(--blue)" })} />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* RIGHT — What's New */}
      <div>
        <h2 style={css("font-family:'Reckless','Newsreader',serif;font-size:22px;font-weight:600;margin-bottom:16px")}>What&apos;s New</h2>
        {WHATS_NEW.map((c) => (
          <div key={c.title} style={sx("border-radius:16px;padding:18px;margin-bottom:16px", { background: c.bg })}>
            <div style={css("height:120px;border-radius:10px;background:rgba(255,255,255,.35);margin-bottom:14px")} />
            <div style={css("display:flex;align-items:center;justify-content:space-between;gap:10px")}>
              <span style={sx("font-family:'Reckless','Newsreader',serif;font-size:19px;font-weight:600", { color: c.fg })}>{c.title}</span>
              <Hoverable as="button" onClick={onBrowse} styles="background:var(--paper);border:none;border-radius:20px;padding:8px 18px;font-size:13px;font-weight:700;color:var(--ink);cursor:pointer;font-family:inherit" hover="filter:brightness(.97)">Browse</Hoverable>
            </div>
          </div>
        ))}
      </div>

      <style>{"@media(max-width:820px){[data-acct-grid]{grid-template-columns:1fr!important}}"}</style>
    </div>
  );
}

function WishlistPanel({ onBrowse }: { onBrowse?: () => void }) {
  return (
    <div>
      <PageHeading>Wishlist</PageHeading>
      <EmptyState title="Your wishlist is empty" text="Tap the heart on any listing to save it here and get notified about price drops." cta="Browse products" onCta={onBrowse} />
    </div>
  );
}

function ReferralPanel() {
  return (
    <div>
      <PageHeading>Refer a friend</PageHeading>
      <div style={css("background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:22px;max-width:560px")}>
        <p style={css("font-size:15px;line-height:1.6;color:var(--ink);margin-bottom:16px")}>Give friends <b>$50 off</b> their first Commonplace order — you get <b>$50</b> when they buy.</p>
        <div style={css("font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-bottom:7px")}>Your referral code</div>
        <div style={css("display:flex;gap:10px;flex-wrap:wrap")}>
          <div style={css("flex:1;min-width:180px;border:1px dashed var(--maroon);border-radius:10px;padding:13px 16px;font-size:17px;font-weight:800;letter-spacing:.06em;color:var(--maroon);text-align:center")}>{CUSTOMER.firstName.toUpperCase()}-CMP</div>
          <PrimaryButton>Copy link</PrimaryButton>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Orders                                                             */
/* ------------------------------------------------------------------ */

const ORDER_TONE: Record<OrderStatus, { bg: string; color: string }> = {
  reserved: { bg: "var(--putty)", color: "var(--muted)" },
  scheduled: { bg: "#F7EDCE", color: "var(--gold)" },
  picked_up: { bg: "var(--blueBg)", color: "var(--blueInk)" },
  in_transit: { bg: "var(--blueBg)", color: "var(--blueInk)" },
  delivered: { bg: "var(--greenBg)", color: "var(--green)" },
  paid: { bg: "var(--greenBg)", color: "var(--green)" },
  cancelled: { bg: "#F5EAE7", color: "var(--red)" },
};

function OrdersPanel({ onBrowse }: { onBrowse?: () => void }) {
  const [orders, setOrders] = useState<OrderRecord[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/orders?limit=50", { signal: ctrl.signal });
        const data: unknown = await res.json();
        const list =
          data && typeof data === "object" && Array.isArray((data as { orders?: unknown }).orders)
            ? ((data as { orders: OrderRecord[] }).orders)
            : [];
        setOrders(list);
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
        setError(true);
        setOrders([]);
      }
    })();
    return () => ctrl.abort();
  }, []);

  return (
    <div>
      <PageHeading>Orders</PageHeading>
      {orders === null ? (
        <Loading label="Loading your orders…" />
      ) : orders.length === 0 ? (
        <EmptyState
          title={error ? "We couldn’t load your orders" : "No order has been made yet"}
          text={error ? "Please try again in a moment — your orders are safe." : "Once you reserve something on Commonplace, it shows up here with live delivery status."}
          cta="Browse products"
          onCta={onBrowse}
        />
      ) : (
        <div style={css("overflow-x:auto;background:var(--paper);border:1px solid var(--line);border-radius:14px")}>
          <table style={css("width:100%;border-collapse:collapse;font-size:14px;min-width:560px")}>
            <thead>
              <tr>
                {["Order", "Date", "Status", "Total", "Actions"].map((h) => (
                  <th key={h} style={css("text-align:left;padding:14px 16px;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);border-bottom:1px solid var(--line);white-space:nowrap")}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const tone = ORDER_TONE[o.status] ?? ORDER_TONE.reserved;
                const delivered = o.status === "delivered" || o.status === "paid";
                return (
                  <tr key={o.id}>
                    <td style={css("padding:14px 16px;border-bottom:1px solid var(--line);white-space:nowrap")}>
                      <span style={css("font-weight:800;color:var(--maroon)")}>#{o.id}</span>
                    </td>
                    <td style={css("padding:14px 16px;border-bottom:1px solid var(--line);color:var(--muted);white-space:nowrap")}>
                      {fmtDate(o.createdAt)}
                    </td>
                    <td style={css("padding:14px 16px;border-bottom:1px solid var(--line)")}>
                      <StatusBadge label={STATUS_LABEL[o.status] ?? o.status} bg={tone.bg} color={tone.color} />
                    </td>
                    <td style={css("padding:14px 16px;border-bottom:1px solid var(--line);white-space:nowrap")}>
                      <b>{formatPrice(o.priceCents)}</b> <span style={css("color:var(--muted)")}>for 1 item</span>
                    </td>
                    <td style={css("padding:14px 16px;border-bottom:1px solid var(--line);white-space:nowrap")}>
                      <div style={css("display:flex;gap:14px")}>
                        <LinkA label="View" />
                        {delivered ? <LinkA label="Order again" /> : <LinkA label="Track" />}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Addresses                                                          */
/* ------------------------------------------------------------------ */

function AddressBlock({ addr }: { addr: AddressCard }) {
  const empty = !addr.line1;
  return (
    <div style={css("background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:18px")}>
      <div style={css("display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px")}>
        <div style={css("display:flex;align-items:center;gap:9px")}>
          <span style={css("width:30px;height:30px;border-radius:9px;flex:0 0 auto;background:var(--tint);color:var(--maroon);display:flex;align-items:center;justify-content:center")}>
            <Pin size={16} stroke="var(--maroon)" />
          </span>
          <span style={css("font-size:15px;font-weight:800")}>{addr.title}</span>
        </div>
        <LinkA label={empty ? `Add ${addr.kind} address` : "Edit"} />
      </div>
      {empty ? (
        <div style={css("font-size:14px;color:var(--muted)")}>You have not set up this type of address yet.</div>
      ) : (
        <address style={css("font-style:normal;font-size:14px;line-height:1.6;color:var(--ink)")}>
          {addr.name && <div style={css("font-weight:600")}>{addr.name}</div>}
          {addr.company && <div style={css("color:var(--muted)")}>{addr.company}</div>}
          {addr.line1 && <div style={css("color:var(--muted)")}>{addr.line1}</div>}
          {addr.line2 && <div style={css("color:var(--muted)")}>{addr.line2}</div>}
          {addr.cityStateZip && <div style={css("color:var(--muted)")}>{addr.cityStateZip}</div>}
          {addr.country && <div style={css("color:var(--muted)")}>{addr.country}</div>}
          {addr.phone && <div style={css("color:var(--muted);margin-top:4px")}>{addr.phone}</div>}
        </address>
      )}
    </div>
  );
}

function AddressesPanel() {
  const [addresses] = useState<AddressCard[]>(ADDRESSES);
  return (
    <div>
      <PageHeading>Addresses</PageHeading>
      <Notice>The following addresses will be used on the checkout page by default.</Notice>
      <div style={css("display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px")}>
        {addresses.map((a) => (
          <AddressBlock key={a.kind} addr={a} />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Payment methods                                                    */
/* ------------------------------------------------------------------ */

function PaymentMethodsPanel() {
  const [cards, setCards] = useState<SavedCard[]>(SAVED_CARDS);
  const makeDefault = (id: string) => setCards((prev) => prev.map((c) => ({ ...c, isDefault: c.id === id })));
  const remove = (id: string) =>
    setCards((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (next.length && !next.some((c) => c.isDefault)) next[0] = { ...next[0], isDefault: true };
      return next;
    });

  return (
    <div>
      <div style={css("display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px")}>
        <PageHeading>Payment methods</PageHeading>
        <GhostButton><Plus size={15} />Add payment method</GhostButton>
      </div>

      {cards.length === 0 ? (
        <EmptyState title="No saved payment methods" text="Add a card to reserve items with $1 and check out at delivery." cta="Add a card" />
      ) : (
        <div style={css("display:flex;flex-direction:column;gap:11px")}>
          {cards.map((c) => {
            const brand = CARD_BRAND_STYLE[c.brand];
            return (
              <div key={c.id} style={css("display:flex;align-items:center;gap:14px;background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:14px 15px")}>
                <div style={sx("width:52px;height:34px;flex:0 0 auto;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;letter-spacing:.02em", { background: brand.bg, color: brand.fg })}>
                  {c.brand === "Mastercard" ? "MC" : c.brand === "Amex" ? "AMEX" : c.brand.toUpperCase()}
                </div>
                <div style={css("flex:1;min-width:0")}>
                  <div style={css("display:flex;align-items:center;gap:9px;flex-wrap:wrap")}>
                    <span style={css("font-size:14.5px;font-weight:700")}>{c.brand} •••• {c.last4}</span>
                    {c.isDefault && (
                      <span style={css("font-size:11px;font-weight:800;color:var(--green);background:var(--greenBg);padding:3px 9px;border-radius:20px")}>Default</span>
                    )}
                  </div>
                  <div style={css("font-size:12.5px;color:var(--muted);margin-top:2px")}>{c.holder} · Expires {c.expiry}</div>
                </div>
                <div style={css("display:flex;align-items:center;gap:14px")}>
                  {!c.isDefault && <LinkA label="Set default" onClick={() => makeDefault(c.id)} />}
                  <LinkA label="Delete" tone="red" onClick={() => remove(c.id)} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Account details                                                    */
/* ------------------------------------------------------------------ */

const FIELD = "width:100%;border:1px solid var(--line);background:var(--paper);border-radius:10px;padding:11px 12px;font-size:14px;color:var(--ink);outline:none;font-family:inherit;box-sizing:border-box";
const LABEL = "font-size:13px;font-weight:700;margin-bottom:6px;display:block;color:var(--ink)";

function Field({ label, value, onChange, type = "text", hint, placeholder }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label style={css(LABEL)}>{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={css(FIELD)}
      />
      {hint && <div style={css("font-size:12px;color:var(--muted);margin-top:5px")}>{hint}</div>}
    </div>
  );
}

function AccountDetailsPanel() {
  const [firstName, setFirstName] = useState(CUSTOMER.firstName);
  const [lastName, setLastName] = useState(CUSTOMER.lastName);
  const [displayName, setDisplayName] = useState(CUSTOMER.displayName);
  const [email, setEmail] = useState(CUSTOMER.email);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [saved, setSaved] = useState(false);

  const onSave = () => {
    setSaved(true);
    setPwCurrent("");
    setPw1("");
    setPw2("");
    window.setTimeout(() => setSaved(false), 2600);
  };

  return (
    <div>
      <PageHeading>Account details</PageHeading>
      {saved && (
        <div style={css("background:var(--greenBg);color:var(--green);border-radius:10px;padding:12px 15px;font-size:14px;font-weight:700;margin-bottom:18px")}>
          Account details changed successfully.
        </div>
      )}
      <div style={css("background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:22px;box-shadow:0 3px 10px rgba(60,10,35,.05)")}>
        <div style={css("display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px")}>
          <Field label="First name *" value={firstName} onChange={setFirstName} />
          <Field label="Last name *" value={lastName} onChange={setLastName} />
        </div>
        <div style={css("margin-top:16px")}>
          <Field
            label="Display name *"
            value={displayName}
            onChange={setDisplayName}
            hint="This will be how your name will be displayed in the account section and in reviews."
          />
        </div>
        <div style={css("margin-top:16px")}>
          <Field label="Email address *" value={email} onChange={setEmail} type="email" />
        </div>

        <fieldset style={css("border:1px solid var(--line);border-radius:12px;padding:18px;margin-top:22px")}>
          <legend style={css("font-size:14px;font-weight:800;padding:0 8px")}>Password change</legend>
          <div style={css("display:flex;flex-direction:column;gap:15px")}>
            <Field label="Current password (leave blank to leave unchanged)" value={pwCurrent} onChange={setPwCurrent} type="password" placeholder="••••••••" />
            <Field label="New password (leave blank to leave unchanged)" value={pw1} onChange={setPw1} type="password" placeholder="••••••••" />
            <Field label="Confirm new password" value={pw2} onChange={setPw2} type="password" placeholder="••••••••" />
          </div>
        </fieldset>

        <div style={css("margin-top:22px")}>
          <PrimaryButton onClick={onSave}>Save changes</PrimaryButton>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* My Listings (seller)                                               */
/* ------------------------------------------------------------------ */

interface ApiListing {
  id?: number;
  sku?: string;
  title?: string;
  priceCents?: number;
  images?: unknown;
  permalink?: string;
}

function toListingRows(items: ApiListing[]): ListingRow[] {
  return items
    .filter((p): p is ApiListing & { id: number } => typeof p.id === "number")
    .map((p) => ({
      id: p.id,
      sku: typeof p.sku === "string" && p.sku ? p.sku : `CP-${p.id}`,
      title: typeof p.title === "string" ? p.title : "Untitled listing",
      image: Array.isArray(p.images) && typeof p.images[0] === "string" ? (p.images[0] as string) : null,
      priceCents: typeof p.priceCents === "number" ? p.priceCents : 0,
      createdAt: "",
      status: "publish",
      permalink: typeof p.permalink === "string" ? p.permalink : "#",
    }));
}

function MyListingsPanel({ onBrowse }: { onBrowse?: () => void }) {
  const [rows, setRows] = useState<ListingRow[] | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/products?per_page=6", { signal: ctrl.signal });
        const data: unknown = await res.json();
        const items =
          data && typeof data === "object" && Array.isArray((data as { items?: unknown }).items)
            ? ((data as { items: ApiListing[] }).items)
            : [];
        const mapped = toListingRows(items);
        // Fall back to representative fixtures when live inventory is unavailable.
        setRows(mapped.length ? mapped : LISTINGS_FALLBACK);
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
        setRows(LISTINGS_FALLBACK);
      }
    })();
    return () => ctrl.abort();
  }, []);

  const remove = (id: number) => setRows((prev) => (prev ? prev.filter((r) => r.id !== id) : prev));

  return (
    <div>
      <div style={css("display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px")}>
        <PageHeading>My Listings</PageHeading>
        <GhostButton onClick={onBrowse}><Plus size={15} />New listing</GhostButton>
      </div>

      {rows === null ? (
        <Loading label="Loading your listings…" />
      ) : rows.length === 0 ? (
        <EmptyState title="No listings found" text="List something you no longer need — we handle pickup, delivery, and payment." cta="Browse the marketplace" onCta={onBrowse} />
      ) : (
        <div style={css("overflow-x:auto;background:var(--paper);border:1px solid var(--line);border-radius:14px")}>
          <table style={css("width:100%;border-collapse:collapse;font-size:14px;min-width:660px")}>
            <thead>
              <tr>
                {["No.", "SKU", "Item", "Listing Date", "Amount", "Status", "Action"].map((h) => (
                  <th key={h} style={css("text-align:left;padding:13px 15px;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);border-bottom:1px solid var(--line);white-space:nowrap")}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const st = LISTING_STATUS_STYLE[r.status];
                return (
                  <tr key={r.id}>
                    <td style={css("padding:13px 15px;border-bottom:1px solid var(--line);color:var(--muted)")}>{i + 1}</td>
                    <td style={css("padding:13px 15px;border-bottom:1px solid var(--line);color:var(--muted);white-space:nowrap")}>{r.sku}</td>
                    <td style={css("padding:13px 15px;border-bottom:1px solid var(--line)")}>
                      <div style={css("display:flex;align-items:center;gap:11px;min-width:220px")}>
                        <Thumb src={r.image} />
                        <span style={css("font-weight:600;line-height:1.35")}>{r.title}</span>
                      </div>
                    </td>
                    <td style={css("padding:13px 15px;border-bottom:1px solid var(--line);color:var(--muted);white-space:nowrap")}>
                      {r.createdAt ? fmtDate(r.createdAt) : "—"}
                    </td>
                    <td style={css("padding:13px 15px;border-bottom:1px solid var(--line);white-space:nowrap")}><b>{formatPrice(r.priceCents)}</b></td>
                    <td style={css("padding:13px 15px;border-bottom:1px solid var(--line)")}>
                      <StatusBadge label={st.label} bg={st.bg} color={st.color} />
                    </td>
                    <td style={css("padding:13px 15px;border-bottom:1px solid var(--line);white-space:nowrap")}>
                      <div style={css("display:flex;align-items:center;gap:12px")}>
                        <IconAction title="View" tone="var(--blueInk)">
                          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />
                        </IconAction>
                        <IconAction title="Edit" tone="var(--gold)">
                          <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                        </IconAction>
                        <IconAction title="Delete" tone="var(--red)" onClick={() => remove(r.id)}>
                          <path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M6 6l1 14h10l1-14" />
                        </IconAction>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function IconAction({ title, tone, onClick, children }: { title: string; tone: string; onClick?: () => void; children: React.ReactNode }) {
  return (
    <Hoverable
      as="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      styles="width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--line);background:var(--paper);border-radius:8px;cursor:pointer;padding:0"
      hover="background:var(--putty)"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={tone} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </Hoverable>
  );
}

/* ------------------------------------------------------------------ */
/* Counter Offers                                                     */
/* ------------------------------------------------------------------ */

const OFFER_TONE: Record<OfferStatus, { label: string; bg: string; color: string }> = {
  pending: { label: "Pending", bg: "#F7EDCE", color: "var(--gold)" },
  countered: { label: "Countered", bg: "var(--blueBg)", color: "var(--blueInk)" },
  accepted: { label: "Accepted", bg: "var(--greenBg)", color: "var(--green)" },
  declined: { label: "Rejected", bg: "#F5EAE7", color: "var(--red)" },
};

function CounterOffersPanel({ onBrowse }: { onBrowse?: () => void }) {
  const [offers, setOffers] = useState<OfferDTO[] | null>(null);
  // Local buyer decisions (no buyer-side endpoint yet) keep the UI responsive.
  const [overrides, setOverrides] = useState<Record<string, OfferStatus>>({});

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/offers?role=buyer", { signal: ctrl.signal });
        const data: unknown = await res.json();
        const list =
          data && typeof data === "object" && Array.isArray((data as { offers?: unknown }).offers)
            ? ((data as { offers: OfferDTO[] }).offers)
            : [];
        setOffers(list);
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
        setOffers([]);
      }
    })();
    return () => ctrl.abort();
  }, []);

  const setStatus = (id: string, status: OfferStatus) => setOverrides((p) => ({ ...p, [id]: status }));

  return (
    <div>
      <PageHeading>Counter Offers</PageHeading>
      {offers === null ? (
        <Loading label="Loading your counter offers…" />
      ) : offers.length === 0 ? (
        <EmptyState
          title="You have no counter offers at this time"
          text="Make an offer on a listing and any seller counters will appear here — accept or decline in one tap."
          cta="Browse products"
          onCta={onBrowse}
        />
      ) : (
        <div style={css("display:flex;flex-direction:column;gap:12px")}>
          <div style={css("font-size:13px;color:var(--muted)")}>
            Showing {offers.length} of {offers.length} counter offer{offers.length === 1 ? "" : "s"}
          </div>
          {offers.map((o) => {
            const status = overrides[o.id] ?? o.status;
            const tone = OFFER_TONE[status] ?? OFFER_TONE.pending;
            const priceCents = o.counterCents ?? o.amountCents;
            const canRespond = status === "countered" || status === "pending";
            return (
              <div key={o.id} style={css("display:flex;gap:14px;background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:15px;flex-wrap:wrap;align-items:flex-start")}>
                <Thumb src={o.listingImage} size={62} />
                <div style={css("flex:1;min-width:200px")}>
                  <div style={css("display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px")}>
                    <span style={css("font-size:15px;font-weight:700;line-height:1.3")}>{o.listingTitle}</span>
                    <StatusBadge label={tone.label} bg={tone.bg} color={tone.color} />
                  </div>
                  <div style={css("font-size:13.5px;color:var(--ink)")}>
                    Counter Offer Price: <b>{formatPrice(priceCents)}</b>
                    <span style={css("color:var(--muted)")}> · list {formatPrice(o.listPriceCents)}</span>
                  </div>
                  <div style={css("font-size:12.5px;color:var(--muted);margin-top:3px")}>Date: {fmtDate(o.createdAt)}</div>

                  <div style={css("display:flex;gap:10px;margin-top:12px;flex-wrap:wrap")}>
                    {status === "accepted" ? (
                      <>
                        <PrimaryButton onClick={onBrowse}>Add to Cart</PrimaryButton>
                        <span style={css("font-size:12.5px;color:var(--muted);align-self:center")}>Added at your counter-offer price.</span>
                      </>
                    ) : status === "declined" ? (
                      <span style={css("font-size:13px;color:var(--muted)")}>You declined this counter offer.</span>
                    ) : canRespond ? (
                      <>
                        <PrimaryButton onClick={() => setStatus(o.id, "accepted")}>Accept Counter Offer</PrimaryButton>
                        <GhostButton onClick={() => setStatus(o.id, "declined")}>Reject Counter Offer</GhostButton>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
