"use client";

import {
  createElement,
  useState,
  type CSSProperties,
  type ElementType,
  type ComponentPropsWithoutRef,
} from "react";

/**
 * Parse an exact CSS declaration string (as authored in the design export)
 * into a React style object, preserving values byte-for-byte. Custom
 * properties (--x) are kept verbatim; standard properties are camelCased.
 *
 * This lets us port the design's inline styles 1:1 without hand-translating
 * hundreds of declarations (and the transcription errors that would invite).
 */
export function css(input: string): CSSProperties {
  const out: Record<string, string> = {};
  for (const decl of input.split(";")) {
    const idx = decl.indexOf(":");
    if (idx < 0) continue;
    const prop = decl.slice(0, idx).trim();
    const value = decl.slice(idx + 1).trim();
    if (!prop || !value) continue;
    const key = prop.startsWith("--")
      ? prop
      : prop.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());
    out[key] = value;
  }
  return out as CSSProperties;
}

/** Merge exact style strings/objects left-to-right. */
export function sx(...parts: (string | CSSProperties | undefined | false)[]): CSSProperties {
  let acc: CSSProperties = {};
  for (const p of parts) {
    if (!p) continue;
    acc = { ...acc, ...(typeof p === "string" ? css(p) : p) };
  }
  return acc;
}

type HoverableProps<T extends ElementType> = {
  as?: T;
  /** Base style — exact string from the design or a style object. */
  styles?: string | CSSProperties;
  /** Extra style applied only while hovered (the design's `style-hover`). */
  hover?: string | CSSProperties;
} & Omit<ComponentPropsWithoutRef<T>, "style" | "className">;

/**
 * Faithful port of the design's `style-hover` attribute: base styles always
 * apply; the hover styles are layered on pointer-over. Polymorphic via `as`.
 */
export function Hoverable<T extends ElementType = "div">({
  as,
  styles,
  hover,
  children,
  ...rest
}: HoverableProps<T>) {
  const [hovered, setHovered] = useState(false);
  const Tag = (as ?? "div") as ElementType;
  return createElement(
    Tag,
    {
      ...rest,
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false),
      style: hovered ? sx(styles, hover) : sx(styles),
    },
    children,
  );
}
