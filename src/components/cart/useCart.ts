"use client";

// Convenience re-export so consumers can import the hook (and cart types)
// directly from "@/components/cart/useCart". The implementation and provider
// live in CartProvider.tsx.
export { useCart, CartProvider, DUE_TODAY_CENTS } from "./CartProvider";
export type { CartItem, CartContextValue } from "./CartProvider";
