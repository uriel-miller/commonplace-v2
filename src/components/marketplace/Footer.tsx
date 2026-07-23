"use client";

import { type ReactNode } from "react";
import { css, Hoverable } from "@/lib/design/css";

/**
 * Site footer for the Commonplace marketplace. Fills the empty space at the
 * bottom of pages (product page, etc.) with a branded closing band.
 *
 * Every navigation handler is optional and guarded, so the footer renders and
 * behaves harmlessly even when dropped into a context that wires up nothing.
 * Self-contained: no images, no external deps — text and inline SVG only.
 */
export interface FooterProps {
  onBrowse?: () => void;
  onSell?: () => void;
  onTrack?: () => void;
  onInfo?: (slug: string) => void;
  onCategory?: (slug: string, name: string) => void;
}

const COL_HEAD = "font-size:11.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);margin-bottom:14px";
const LINK_BASE = "display:inline-block;font-size:14px;color:var(--muted);line-height:1;padding:5px 0;cursor:pointer;text-decoration:none;background:transparent;border:none;font-family:inherit";
const LINK_HOVER = "color:var(--ink)";

/** A single footer link — a Hoverable anchor that guards its handler. */
function FLink({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <Hoverable as="a" role="button" tabIndex={0} onClick={() => onClick?.()} styles={LINK_BASE} hover={LINK_HOVER}>
      {label}
    </Hoverable>
  );
}

/** A small circular social button with an inline-SVG glyph. */
function Social({ label, href, children }: { label: string; href: string; children: ReactNode }) {
  return (
    <Hoverable
      as="a"
      aria-label={label}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      styles="display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:transparent;border:1px solid var(--line);color:var(--muted);text-decoration:none;transition:all .15s"
      hover="color:var(--maroon);border-color:var(--maroon)"
    >
      {children}
    </Hoverable>
  );
}

export function Footer({ onBrowse, onSell, onTrack, onInfo, onCategory }: FooterProps) {
  return (
    <footer style={css("width:100%;margin-top:auto")}>
      <style>{"@media(max-width:720px){[data-footer-cols]{grid-template-columns:1fr 1fr!important}}"}</style>

      {/* Top band — plum, tagline + sell CTA */}
      <div style={css("background:var(--maroon);color:#fff")}>
        <div style={css("max-width:1160px;margin:0 auto;padding:60px 24px 64px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:26px")}>
          <h2 style={css("font-family:'Reckless','Newsreader',serif;font-weight:600;font-size:clamp(30px,5vw,48px);line-height:1.08;letter-spacing:-.01em;color:#fff;max-width:14ch")}>
            Where big things change hands.
          </h2>
          <Hoverable
            as="button"
            onClick={() => onSell?.()}
            styles="border:none;border-radius:30px;padding:14px 30px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;background:#fff;color:var(--maroon);transition:transform .15s,box-shadow .15s"
            hover="transform:translateY(-1px);box-shadow:0 10px 26px rgba(0,0,0,.22)"
          >
            Sell on Commonplace
          </Hoverable>
        </div>
      </div>

      {/* Link section — cream, four columns */}
      <div style={css("background:var(--cream);border-top:1px solid var(--line)")}>
        <div style={css("max-width:1160px;margin:0 auto;padding:48px 24px 40px")}>
          <div data-footer-cols style={css("display:grid;grid-template-columns:repeat(4,1fr);gap:32px 24px")}>
            {/* Shop */}
            <div>
              <div style={css(COL_HEAD)}>Shop</div>
              <div style={css("display:flex;flex-direction:column;align-items:flex-start")}>
                <FLink label="Browse all" onClick={() => onBrowse?.()} />
                <FLink label="Fitness" onClick={() => onBrowse?.()} />
                <FLink label="Wellness" onClick={() => onBrowse?.()} />
                <FLink label="Vehicles" onClick={() => onBrowse?.()} />
              </div>
            </div>

            {/* Company */}
            <div>
              <div style={css(COL_HEAD)}>Company</div>
              <div style={css("display:flex;flex-direction:column;align-items:flex-start")}>
                <FLink label="About Us" onClick={() => onInfo?.("about")} />
                <FLink label="Refer" onClick={() => onInfo?.("refer")} />
                <FLink label="Contact Us" onClick={() => onInfo?.("contact")} />
                <FLink label="Reviews" onClick={() => onInfo?.("reviews")} />
              </div>
            </div>

            {/* Support */}
            <div>
              <div style={css(COL_HEAD)}>Support</div>
              <div style={css("display:flex;flex-direction:column;align-items:flex-start")}>
                <FLink label="How it works" onClick={() => onInfo?.("how-it-works")} />
                <FLink label="Track order" onClick={() => onTrack?.()} />
                <FLink label="Sell an item" onClick={() => onSell?.()} />
              </div>
            </div>

            {/* Legal */}
            <div>
              <div style={css(COL_HEAD)}>Legal</div>
              <div style={css("display:flex;flex-direction:column;align-items:flex-start")}>
                <FLink label="Terms & Conditions" onClick={() => onInfo?.("terms")} />
                <FLink label="Privacy Policy" onClick={() => onInfo?.("privacy")} />
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div style={css("margin-top:40px;padding-top:22px;border-top:1px solid var(--line);display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px")}>
            <div style={css("font-size:12.5px;color:var(--muted)")}>© 2026 Commonplace. All rights reserved.</div>
            <div style={css("display:flex;align-items:center;gap:10px")}>
              <Social label="Instagram" href="https://instagram.com/">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none" />
                </svg>
              </Social>
              <Social label="Facebook" href="https://facebook.com/">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M14 9V7.2c0-.9.2-1.3 1.4-1.3H17V3.2C16.6 3.1 15.6 3 14.5 3 12 3 10.4 4.5 10.4 7v2H8v3h2.4v9H14v-9h2.4l.4-3H14z" />
                </svg>
              </Social>
              <Social label="YouTube" href="https://youtube.com/">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.5 7.2a2.7 2.7 0 0 0-1.9-1.9C18.9 4.8 12 4.8 12 4.8s-6.9 0-8.6.5A2.7 2.7 0 0 0 1.5 7.2C1 8.9 1 12 1 12s0 3.1.5 4.8a2.7 2.7 0 0 0 1.9 1.9c1.7.5 8.6.5 8.6.5s6.9 0 8.6-.5a2.7 2.7 0 0 0 1.9-1.9c.5-1.7.5-4.8.5-4.8s0-3.1-.5-4.8zM9.8 15.3V8.7l5.7 3.3-5.7 3.3z" />
                </svg>
              </Social>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
