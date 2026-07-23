"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Listing } from "@/lib/listing";

/** A single line in the cart: a listing plus how many of it. */
export interface CartItem {
  listing: Listing;
  qty: number;
}

/** What `useCart()` returns. */
export interface CartContextValue {
  items: CartItem[];
  /** Total number of units across all lines. */
  count: number;
  /** Sum of priceCents * qty across all lines. */
  subtotalCents: number;
  /** Flat reservation charged up front, in cents ($1). */
  dueTodayCents: number;
  /** Remainder charged at delivery, in cents (never below 0). */
  dueOnDeliveryCents: number;
  /** True once localStorage has been read (avoids SSR/first-paint flicker). */
  hydrated: boolean;
  /** Add a listing (defaults to qty 1). Merges into an existing line. */
  add: (listing: Listing, qty?: number) => void;
  /** Remove a line entirely by listing id. */
  remove: (listingId: number) => void;
  /** Set an exact quantity for a line. qty <= 0 removes the line. */
  updateQty: (listingId: number, qty: number) => void;
  /** True if a listing id is already in the cart. */
  has: (listingId: number) => boolean;
  /** Empty the cart. */
  clear: () => void;
}

/** Flat deposit taken up front, in cents. The rest is paid on delivery. */
export const DUE_TODAY_CENTS = 100;

const STORAGE_KEY = "cp_cart_v1";

const CartContext = createContext<CartContextValue | null>(null);

/** Narrow unknown localStorage JSON into well-formed CartItems. */
function parseStored(raw: string | null): CartItem[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: CartItem[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue;
      const { listing, qty } = entry as { listing?: unknown; qty?: unknown };
      if (!listing || typeof listing !== "object") continue;
      const l = listing as Partial<Listing>;
      if (typeof l.id !== "number" || typeof l.priceCents !== "number") continue;
      const n = typeof qty === "number" && Number.isFinite(qty) ? Math.floor(qty) : 1;
      if (n <= 0) continue;
      out.push({ listing: l as Listing, qty: Math.min(n, 99) });
    }
    return out;
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  // Guards the persistence effect so we never overwrite storage before we've read it.
  const loaded = useRef(false);

  // Hydrate from localStorage once, after mount (never during SSR).
  useEffect(() => {
    try {
      setItems(parseStored(window.localStorage.getItem(STORAGE_KEY)));
    } catch {
      // localStorage may be unavailable (private mode / blocked cookies); start empty.
    }
    loaded.current = true;
    setHydrated(true);
  }, []);

  // Persist on every change, but only after the initial read.
  useEffect(() => {
    if (!loaded.current) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignore quota / availability errors — the in-memory cart still works.
    }
  }, [items]);

  // Sync across tabs/windows.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) setItems(parseStored(e.newValue));
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const add = useCallback((listing: Listing, qty = 1) => {
    const inc = Math.max(1, Math.floor(qty));
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.listing.id === listing.id);
      if (idx === -1) return [...prev, { listing, qty: Math.min(inc, 99) }];
      const next = prev.slice();
      next[idx] = { listing, qty: Math.min(next[idx].qty + inc, 99) };
      return next;
    });
  }, []);

  const remove = useCallback((listingId: number) => {
    setItems((prev) => prev.filter((i) => i.listing.id !== listingId));
  }, []);

  const updateQty = useCallback((listingId: number, qty: number) => {
    const n = Math.floor(qty);
    setItems((prev) => {
      if (n <= 0) return prev.filter((i) => i.listing.id !== listingId);
      return prev.map((i) =>
        i.listing.id === listingId ? { ...i, qty: Math.min(n, 99) } : i,
      );
    });
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((sum, i) => sum + i.qty, 0);
    const subtotalCents = items.reduce(
      (sum, i) => sum + i.listing.priceCents * i.qty,
      0,
    );
    const dueTodayCents = count > 0 ? DUE_TODAY_CENTS : 0;
    const dueOnDeliveryCents = Math.max(0, subtotalCents - dueTodayCents);
    const ids = new Set(items.map((i) => i.listing.id));
    return {
      items,
      count,
      subtotalCents,
      dueTodayCents,
      dueOnDeliveryCents,
      hydrated,
      add,
      remove,
      updateQty,
      has: (id: number) => ids.has(id),
      clear,
    };
  }, [items, hydrated, add, remove, updateQty, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/** Access the cart. Must be used within a <CartProvider>. */
export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within a <CartProvider>");
  }
  return ctx;
}
