"use client";

import { css, sx, Hoverable } from "@/lib/design/css";

/**
 * Site footer — the live trycommonplace.com footer (commonplace wordmark +
 * ABOUT / CONNECT / POLICIES columns, the Become-a-Driver / Track / Refer row,
 * and support contact), rendered on a LIGHT surface instead of the dark one.
 */

export interface FooterProps {
  onBrowse?: () => void;
  onSell?: () => void;
  onTrack?: () => void;
  onInfo?: (slug: string) => void;
  onCategory?: (slug: string, name: string) => void;
  onBlog?: () => void;
}

const LOGO = "/design-assets/805cd68e-4bc0-474c-9062-282704b82b24.svg";

const HEAD = "font-size:12px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--ink);margin-bottom:14px";
const LINK = "font-size:14px;color:var(--muted);cursor:pointer;line-height:2;display:block;text-decoration:none;width:fit-content";

export function Footer({ onTrack, onInfo, onBlog }: FooterProps) {
  // Internal links map to the closest existing v2 page.
  const ABOUT: [string, () => void][] = [
    ["About Us", () => onInfo?.("about")],
    ["Our Process", () => onInfo?.("about")],
    ["Blog & Guides", () => onBlog?.()],
    ["FAQs", () => onInfo?.("contact")],
    ["Refer & Earn", () => onInfo?.("refer")],
    ["Join as a Crosslister", () => onInfo?.("refer")],
  ];
  const POLICIES: [string, () => void][] = [
    ["Warranty", () => onInfo?.("warranty")],
    ["Terms & Conditions", () => onInfo?.("terms")],
    ["Return Policy", () => onInfo?.("return-policy")],
    ["Privacy Policy", () => onInfo?.("privacy")],
    ["Information Security Policy", () => onInfo?.("information-security")],
  ];
  const SOCIAL: [string, string][] = [
    ["Instagram", "https://instagram.com/trycommonplace"],
    ["YouTube", "https://youtube.com/@trycommonplace"],
    ["TikTok", "https://tiktok.com/@trycommonplace"],
  ];

  return (
    <footer style={css("background:var(--putty);border-top:1px solid #E3D8CC;box-shadow:inset 0 1px 0 #fff;margin-top:44px")}>
      <div style={css("max-width:1200px;margin:0 auto;padding:48px 24px 26px")}>
        <div style={css("display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr;gap:32px;align-items:start")} data-footer-cols>
          {/* Wordmark → support → secondary links (left column) */}
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO} alt="Commonplace" style={css("height:30px;width:auto;display:block")} />
            <div style={css("margin-top:56px;font-size:13.5px;color:var(--muted);line-height:1.9")}>
              <div><b style={css("color:var(--ink)")}>Commonplace Support:</b> Sunday &ndash; Friday, 9 AM &ndash; 9 PM ET</div>
              <div style={css("display:flex;gap:18px;flex-wrap:wrap")}>
                <a href="tel:+15163575989" style={sx("color:var(--maroon);text-decoration:none;font-weight:600")}>(516) 357-5989</a>
                <a href="mailto:service@trycommonplace.com" style={sx("color:var(--maroon);text-decoration:none;font-weight:600")}>service@trycommonplace.com</a>
              </div>
            </div>
            <div style={css("display:flex;gap:20px;flex-wrap:wrap;margin-top:16px")}>
              <a href="https://trycommonplace.com/drive" target="_blank" rel="noreferrer" style={css("font-size:14px;font-weight:600;color:var(--ink);cursor:pointer;text-decoration:underline")}>Become a Driver</a>
              <Hoverable as="a" onClick={onTrack} styles="font-size:14px;font-weight:600;color:var(--ink);cursor:pointer;text-decoration:underline" hover="color:var(--maroon)">Track Your Order</Hoverable>
              <Hoverable as="a" onClick={() => onInfo?.("refer")} styles="font-size:14px;font-weight:600;color:var(--ink);cursor:pointer;text-decoration:underline" hover="color:var(--maroon)">Refer a Friend</Hoverable>
            </div>
          </div>

          {/* ABOUT */}
          <div>
            <div style={css(HEAD)}>About</div>
            {ABOUT.map(([label, fn]) => (
              <Hoverable key={label} as="a" onClick={fn} styles={LINK} hover="color:var(--maroon)">{label}</Hoverable>
            ))}
          </div>

          {/* CONNECT */}
          <div>
            <div style={css(HEAD)}>Connect</div>
            <Hoverable as="a" onClick={() => onInfo?.("contact")} styles={LINK} hover="color:var(--maroon)">Contact Us</Hoverable>
            {SOCIAL.map(([label, href]) => (
              <a key={label} href={href} target="_blank" rel="noreferrer" style={css(LINK)}>{label}</a>
            ))}
          </div>

          {/* POLICIES */}
          <div>
            <div style={css(HEAD)}>Policies</div>
            {POLICIES.map(([label, fn]) => (
              <Hoverable key={label} as="a" onClick={fn} styles={LINK} hover="color:var(--maroon)">{label}</Hoverable>
            ))}
          </div>
        </div>

        {/* Copyright */}
        <div style={css("font-size:13px;color:var(--muted);margin-top:36px;padding-top:22px;border-top:1px solid var(--line)")}>© Commonplace. 2026. All rights reserved.</div>
      </div>

      <style>{"@media(max-width:820px){[data-footer-cols]{grid-template-columns:1fr 1fr!important;gap:26px!important}}@media(max-width:520px){[data-footer-cols]{grid-template-columns:1fr!important}}"}</style>
    </footer>
  );
}

export default Footer;
