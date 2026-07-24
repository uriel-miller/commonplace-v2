import { css, sx } from "@/lib/design/css";

/**
 * Real-looking payment method badges (card chips) rendered as inline SVG/markup
 * — no external images. Each brand is a small rounded "card" with its signature
 * color + wordmark, matching the live trycommonplace.com checkout badge strip.
 */

const CHIP = "height:23px;min-width:36px;padding:0 7px;border-radius:5px;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 2px rgba(20,10,25,.10);flex:0 0 auto";
const WHITE = sx(CHIP, "background:#fff;border:1px solid #E7DDCF");

function Chip({ bg, border, children }: { bg?: string; border?: string; children: React.ReactNode }) {
  return <span style={sx(CHIP, { background: bg ?? "#fff", border: `1px solid ${border ?? (bg ? bg : "#E7DDCF")}` })}>{children}</span>;
}

function Visa() {
  return <span style={WHITE}><span style={css("font-family:Arial,Helvetica,sans-serif;font-style:italic;font-weight:800;font-size:12px;letter-spacing:.3px;color:#1434CB")}>VISA</span></span>;
}

function Mastercard() {
  return (
    <span style={WHITE}>
      <svg width="30" height="19" viewBox="0 0 30 19" aria-label="Mastercard">
        <circle cx="12" cy="9.5" r="6.4" fill="#EB001B" />
        <circle cx="18" cy="9.5" r="6.4" fill="#F79E1B" />
        <path d="M15 4.4a6.4 6.4 0 0 1 0 10.2 6.4 6.4 0 0 1 0-10.2Z" fill="#FF5F00" />
      </svg>
    </span>
  );
}

function Amex() {
  return <Chip bg="#1F72CF"><span style={css("font-family:Arial,Helvetica,sans-serif;font-weight:800;font-size:10px;letter-spacing:.3px;color:#fff")}>AMEX</span></Chip>;
}

function Discover() {
  return (
    <span style={WHITE}>
      <span style={css("display:flex;align-items:center;gap:3px")}>
        <span style={css("font-family:Arial,Helvetica,sans-serif;font-weight:800;font-size:9px;letter-spacing:.2px;color:#1a1a1a")}>DISC</span>
        <span style={css("width:9px;height:9px;border-radius:50%;background:#FF6000")} />
        <span style={css("font-family:Arial,Helvetica,sans-serif;font-weight:800;font-size:9px;letter-spacing:.2px;color:#1a1a1a")}>VER</span>
      </span>
    </span>
  );
}

function PayPal() {
  return (
    <span style={WHITE}>
      <span style={css("font-family:Arial,Helvetica,sans-serif;font-style:italic;font-weight:800;font-size:11px;letter-spacing:-.2px")}>
        <span style={css("color:#003087")}>Pay</span><span style={css("color:#009CDE")}>Pal</span>
      </span>
    </span>
  );
}

function ApplePay() {
  return (
    <Chip bg="#000">
      <span style={css("display:flex;align-items:center;gap:3px")}>
        <svg width="11" height="13" viewBox="0 0 14 17" fill="#fff" aria-hidden="true"><path d="M11.2 9c0-1.7 1.4-2.5 1.5-2.6-.8-1.2-2.1-1.4-2.5-1.4-1.1-.1-2.1.6-2.6.6-.5 0-1.3-.6-2.2-.6-1.1 0-2.2.7-2.7 1.7-1.2 2-.3 5 .8 6.6.5.8 1.2 1.7 2 1.6.8 0 1.1-.5 2.1-.5s1.3.5 2.1.5 1.4-.8 1.9-1.6c.6-.9.9-1.8.9-1.8-.1 0-1.8-.7-1.8-2.5ZM9.6 3.9c.4-.5.7-1.3.6-2-.6 0-1.4.4-1.9 1-.4.4-.8 1.2-.7 1.9.7.1 1.5-.4 2-1Z" /></svg>
        <span style={css("font-family:-apple-system,Arial,sans-serif;font-weight:600;font-size:11px;color:#fff")}>Pay</span>
      </span>
    </Chip>
  );
}

function Venmo() {
  return <span style={WHITE}><span style={css("font-family:Arial,Helvetica,sans-serif;font-weight:800;font-size:11px;letter-spacing:-.2px;color:#008CFF")}>venmo</span></span>;
}

function Klarna() {
  return <Chip bg="#FFB3C7"><span style={css("font-family:Arial,Helvetica,sans-serif;font-weight:800;font-size:10.5px;letter-spacing:.1px;color:#0A0B09")}>Klarna.</span></Chip>;
}

export function PaymentBadges({ align = "center" }: { align?: "center" | "flex-start" }) {
  return (
    <div style={sx("display:flex;align-items:center;gap:7px;flex-wrap:wrap", { justifyContent: align })}>
      <Visa />
      <Mastercard />
      <Amex />
      <Discover />
      <PayPal />
      <ApplePay />
      <Venmo />
      <Klarna />
    </div>
  );
}

export default PaymentBadges;
