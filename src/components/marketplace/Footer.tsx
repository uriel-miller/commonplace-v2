"use client";

import { type ReactNode } from "react";
import { css, Hoverable } from "@/lib/design/css";
import { CAT_GROUPS } from "./data";

/**
 * Site footer — a faithful match of the live trycommonplace.com footer: a light
 * footer with a "Sell on Commonplace" band, a large grid of popular category
 * links, a Company nav column, and a bottom bar with the © line +
 * Instagram / YouTube / TikTok.
 */

export interface FooterProps {
  onBrowse?: () => void;
  onSell?: () => void;
  onTrack?: () => void;
  onInfo?: (slug: string) => void;
  onCategory?: (slug: string, name: string) => void;
}

const ALL_CATS = CAT_GROUPS.flatMap((g) => g.items).filter(
  (c) => c.slug !== "vehicles" && c.slug !== "cars" && c.name !== "All Vehicles",
);

const POPULAR: { label: string; slug: string; name: string }[] = [
  { label: "Sell a Used Peloton Bike", slug: "peloton-bike-2nd-gen", name: "Peloton Bike" },
  { label: "Sell a Used Peloton Tread", slug: "peloton-tread", name: "Peloton Tread" },
  { label: "Sell a Used Hydrow Rower", slug: "hydrow-pro-rowing-machine", name: "Hydrow" },
  { label: "Sell a Used Treadmill", slug: "treadmills", name: "Treadmills" },
  { label: "Sell a Used Hot Tub", slug: "hot-tubs", name: "Hot Tubs" },
  { label: "Sell a Used Swim Spa", slug: "swim-spa", name: "Swim Spa" },
  { label: "Sell a Used Sauna", slug: "sauna", name: "Sauna" },
  { label: "Sell a Used Cold Plunge", slug: "cold-plunge", name: "Cold Plunge" },
  { label: "Sell a Used Massage Chair", slug: "massage-chair", name: "Massage Chair" },
  { label: "Sell a Used Golf Cart", slug: "golf-carts", name: "Golf Carts" },
  { label: "Sell a Used ATV", slug: "atv", name: "ATV" },
  { label: "Sell a Used Tonal", slug: "tonal", name: "Tonal" },
  { label: "Sell a Used Home Gym", slug: "home-gym", name: "Home Gym" },
  { label: "Sell a Used Elliptical", slug: "elliptical", name: "Elliptical" },
  { label: "Sell a Used Rowing Machine", slug: "rower", name: "Rowing Machine" },
  { label: "Sell a Used Spin Bike", slug: "spin-bike", name: "Spin Bike" },
];

const NAV_LINKS: { label: string; slug: string }[] = [
  { label: "About Us", slug: "about" },
  { label: "Our Process", slug: "how-it-works" },
  { label: "FAQs", slug: "faq" },
  { label: "Refer & Earn", slug: "refer" },
  { label: "Contact Us", slug: "contact" },
  { label: "Terms & Conditions", slug: "terms" },
  { label: "Privacy Policy", slug: "privacy" },
];

function Social({ path, label }: { path: ReactNode; label: string }) {
  return (
    <Hoverable as="span" aria-label={label} styles="width:34px;height:34px;border-radius:50%;background:var(--paper);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--ink)" hover="border-color:var(--maroon);color:var(--maroon)">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">{path}</svg>
    </Hoverable>
  );
}

const LINK = "font-size:13.5px;color:var(--muted);cursor:pointer;line-height:1.9;display:block;text-decoration:none";

export function Footer({ onBrowse, onSell, onInfo, onCategory }: FooterProps) {
  return (
    <footer style={css("background:var(--cream);border-top:1px solid var(--line);margin-top:40px")}>
      {/* Sell-on-Commonplace band */}
      <div style={css("border-bottom:1px solid var(--line)")}>
        <div style={css("max-width:1200px;margin:0 auto;padding:32px 24px;display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap")}>
          <div>
            <div style={css("font-family:'Reckless','Newsreader',serif;font-size:24px;font-weight:600;color:var(--ink)")}>Sell on Commonplace</div>
            <div style={css("font-size:14px;color:var(--muted);margin-top:3px")}>Free pickup, white-glove delivery, and you get paid fast.</div>
          </div>
          <Hoverable as="button" onClick={onSell} styles="background:var(--maroon);color:#fff;border:none;border-radius:26px;padding:13px 28px;font-size:14.5px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap" hover="filter:brightness(1.08)">List an item</Hoverable>
        </div>
      </div>

      {/* Link grid */}
      <div style={css("max-width:1200px;margin:0 auto;padding:36px 24px 20px;display:grid;grid-template-columns:2fr 2fr 1fr;gap:32px")} data-footer-cols>
        <div>
          <div style={css("font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--ink);margin-bottom:10px")}>Popular on Commonplace</div>
          <div style={css("display:grid;grid-template-columns:1fr 1fr;gap:0 24px")}>
            {POPULAR.map((p) => (
              <Hoverable key={p.label} as="a" onClick={() => onCategory?.(p.slug, p.name)} styles={LINK} hover="color:var(--maroon)">{p.label}</Hoverable>
            ))}
          </div>
        </div>

        <div>
          <div style={css("font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--ink);margin-bottom:10px")}>Shop by category</div>
          <div style={css("display:grid;grid-template-columns:1fr 1fr;gap:0 24px")}>
            {ALL_CATS.slice(0, 24).map((c) => (
              <Hoverable key={c.slug} as="a" onClick={() => onCategory?.(c.slug, c.name)} styles={LINK} hover="color:var(--maroon)">{c.name}</Hoverable>
            ))}
          </div>
        </div>

        <div>
          <div style={css("font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--ink);margin-bottom:10px")}>Company</div>
          {NAV_LINKS.map((n) => (
            <Hoverable key={n.slug} as="a" onClick={() => onInfo?.(n.slug)} styles={LINK} hover="color:var(--maroon)">{n.label}</Hoverable>
          ))}
          <Hoverable as="a" onClick={onBrowse} styles={LINK} hover="color:var(--maroon)">Browse all</Hoverable>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={css("border-top:1px solid var(--line)")}>
        <div style={css("max-width:1200px;margin:0 auto;padding:18px 24px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap")}>
          <div style={css("font-size:13px;color:var(--muted)")}>© Commonplace. 2026. All rights reserved.</div>
          <div style={css("display:flex;gap:10px")}>
            <Social label="Instagram" path={<path d="M12 2.2c3.2 0 3.6 0 4.8.07 1.2.05 1.9.24 2.3.4.6.22 1 .5 1.5 1 .5.5.77.9 1 1.5.16.4.35 1.1.4 2.3.06 1.2.07 1.6.07 4.8s0 3.6-.07 4.8c-.05 1.2-.24 1.9-.4 2.3-.22.6-.5 1-1 1.5-.5.5-.9.77-1.5 1-.4.16-1.1.35-2.3.4-1.2.06-1.6.07-4.8.07s-3.6 0-4.8-.07c-1.2-.05-1.9-.24-2.3-.4-.6-.22-1-.5-1.5-1-.5-.5-.77-.9-1-1.5-.16-.4-.35-1.1-.4-2.3C2.2 15.6 2.2 15.2 2.2 12s0-3.6.07-4.8c.05-1.2.24-1.9.4-2.3.22-.6.5-1 1-1.5.5-.5.9-.77 1.5-1 .4-.16 1.1-.35 2.3-.4C8.4 2.2 8.8 2.2 12 2.2Zm0 3.2A6.6 6.6 0 1 0 18.6 12 6.6 6.6 0 0 0 12 5.4Zm0 10.9A4.3 4.3 0 1 1 16.3 12 4.3 4.3 0 0 1 12 16.3Zm6.8-11.2a1.55 1.55 0 1 1-1.55-1.55A1.55 1.55 0 0 1 18.8 5.1Z" />} />
            <Social label="YouTube" path={<path d="M23 8.2s-.2-1.6-.9-2.3c-.9-.9-1.8-.9-2.3-1C17.4 4.6 12 4.6 12 4.6h0s-5.4 0-7.8.3c-.5.1-1.4.1-2.3 1C1.2 6.6 1 8.2 1 8.2S.8 10 .8 11.9v1.7C.8 15.5 1 17.3 1 17.3s.2 1.6.9 2.3c.9.9 2 .9 2.5 1 1.8.2 7.6.3 7.6.3s5.4 0 7.8-.3c.5-.1 1.4-.1 2.3-1 .7-.7.9-2.3.9-2.3s.2-1.8.2-3.7v-1.7C23.2 10 23 8.2 23 8.2ZM9.7 15.4V8.9l5.7 3.3Z" />} />
            <Social label="TikTok" path={<path d="M16.6 5.8a4.8 4.8 0 0 1-1.1-2.8h-3v12.1a2.7 2.7 0 1 1-2-2.6V9.4a5.7 5.7 0 1 0 5 5.6V9.1a7.8 7.8 0 0 0 4.4 1.4v-3a4.8 4.8 0 0 1-3.3-1.7Z" />} />
          </div>
        </div>
      </div>

      <style>{"@media(max-width:820px){[data-footer-cols]{grid-template-columns:1fr!important;gap:26px!important}}"}</style>
    </footer>
  );
}

export default Footer;
