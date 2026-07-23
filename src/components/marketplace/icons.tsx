import type { CSSProperties } from "react";

// Inline SVG icons ported verbatim from the design export. Kept as small
// components to avoid repeating identical markup across views.

type IconProps = { size?: number; style?: CSSProperties; stroke?: string; strokeWidth?: number };

export const Chevron = ({ size = 15, style, stroke = "var(--muted)", strokeWidth = 2.2 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} style={style}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const ChevronRight = ({ size = 16, stroke = "var(--muted)", strokeWidth = 2.2 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export const ChevronLeft = ({ size = 15, stroke = "currentColor", strokeWidth = 2.4 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth}>
    <path d="m15 6-6 6 6 6" />
  </svg>
);

export const Pin = ({ size = 16, stroke = "currentColor", strokeWidth = 2 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth}>
    <path d="M12 21s-7-6.3-7-11a7 7 0 0 1 14 0c0 4.7-7 11-7 11Z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);

export const Plus = ({ size = 17, stroke = "currentColor", strokeWidth = 2.6 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export const Close = ({ size = 16, stroke = "var(--ink)", strokeWidth = 2.2 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const Search = ({ size = 17, stroke = "currentColor", strokeWidth = 2.2 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth}>
    <circle cx="11" cy="11" r="7" />
    <line x1="16.5" y1="16.5" x2="21" y2="21" />
  </svg>
);
