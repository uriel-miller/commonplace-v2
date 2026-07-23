import type { CSSProperties } from "react";

// Maps a palette token (e.g. "maroon", "blue-ink") to a soft placeholder
// surface + matching accent ink, using the design-system CSS variables.
export function tintSurface(token: string): CSSProperties {
  const c = `var(--color-${token})`;
  return {
    backgroundColor: `color-mix(in srgb, ${c} 12%, white)`,
    color: c,
  };
}

export function tintAccent(token: string): CSSProperties {
  return { color: `var(--color-${token})` };
}
