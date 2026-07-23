"use client";

import { useState, type ComponentType } from "react";
import { css, sx, Hoverable } from "@/lib/design/css";
import DashboardOverview from "./DashboardOverview";
import { ListingsAdmin } from "./ListingsAdmin";
import OrdersAdmin from "./OrdersAdmin";
import OffersAdmin from "./OffersAdmin";
import SellersAdmin from "./SellersAdmin";
import FeesAdmin from "./FeesAdmin";

type TabKey = "dashboard" | "listings" | "orders" | "offers" | "sellers" | "fees";

const TABS: { key: TabKey; label: string; Panel: ComponentType; icon: React.ReactNode }[] = [
  { key: "dashboard", label: "Dashboard", Panel: DashboardOverview, icon: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></> },
  { key: "listings", label: "Listings", Panel: ListingsAdmin, icon: <><path d="M4 9h16l-1-4.5H5L4 9Z" /><path d="M5 9v10.5h14V9" /></> },
  { key: "orders", label: "Orders", Panel: OrdersAdmin, icon: <><rect x="4" y="4" width="16" height="16" rx="2.5" /><path d="M8 9h8M8 13h8M8 17h5" /></> },
  { key: "offers", label: "Offers", Panel: OffersAdmin, icon: <><path d="M12 3v18M5 8h9a3 3 0 0 1 0 6H7" /></> },
  { key: "sellers", label: "Sellers", Panel: SellersAdmin, icon: <><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" /></> },
  { key: "fees", label: "Fees", Panel: FeesAdmin, icon: <><circle cx="12" cy="12" r="9" /><path d="M9 9h4.5a1.5 1.5 0 0 1 0 3H10l4 3" /></> },
];

export function AdminApp() {
  const [active, setActive] = useState<TabKey>("dashboard");
  const ActivePanel = TABS.find((t) => t.key === active)?.Panel ?? DashboardOverview;

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" }).catch(() => {});
    window.location.href = "/admin";
  }

  return (
    <div style={css("min-height:100dvh;display:flex;background:var(--cream);color:var(--ink)")}>
      {/* Sidebar */}
      <aside style={css("flex:0 0 232px;background:var(--maroon);color:#fff;display:flex;flex-direction:column;padding:16px 12px")}>
        <div style={css("font-family:'Reckless','Newsreader',serif;font-size:20px;font-weight:600;padding:6px 10px 16px")}>Commonplace<span style={css("opacity:.7;font-size:13px;display:block;font-family:'Roobert','Inter Tight',sans-serif")}>Admin</span></div>
        {TABS.map((t) => {
          const on = active === t.key;
          return (
            <Hoverable key={t.key} onClick={() => setActive(t.key)}
              styles={sx("display:flex;align-items:center;gap:11px;padding:10px 11px;border-radius:9px;cursor:pointer;font-size:14px;font-weight:600;margin-bottom:2px", on ? { background: "rgba(255,255,255,.16)" } : { color: "rgba(255,255,255,.82)" })}
              hover="background:rgba(255,255,255,.1)">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">{t.icon}</svg>
              {t.label}
            </Hoverable>
          );
        })}
        <div style={css("flex:1")} />
        <a href="/" style={css("padding:10px 11px;font-size:13px;color:rgba(255,255,255,.82);text-decoration:none")}>↗ View site</a>
        <div onClick={logout} style={css("padding:10px 11px;font-size:13px;color:rgba(255,255,255,.82);cursor:pointer")}>Log out</div>
      </aside>

      {/* Content */}
      <main style={css("flex:1;min-width:0;overflow-y:auto;height:100dvh")}>
        <div style={css("background:var(--paper);border-bottom:1px solid var(--line);padding:16px 26px")}>
          <div style={css("font-family:'Reckless','Newsreader',serif;font-size:22px;font-weight:600")}>{TABS.find((t) => t.key === active)?.label}</div>
        </div>
        <div style={css("padding:24px 26px 60px")}>
          <ActivePanel />
        </div>
      </main>
    </div>
  );
}
