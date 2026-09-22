"use client";

// ── Basket ──────────────────────────────────────────────────────────────────
// Client-side (localStorage) with one source of truth for the badge, the basket
// page and the checkout review. Prices here are only for display — the checkout
// API re-prices everything from the database before a single Toman is charged.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type CartItem = {
  key: string; // slug + months + design → add the same thing twice and it merges
  slug: string;
  name: string;
  kind: string;
  rankKey?: string | null;
  months?: number;
  label?: string;
  unitPrice: number;
  quantity: number;
  customTag?: string;
  customDesign?: string;
  customPrefix?: string;
};

type CartContext = {
  items: CartItem[];
  count: number;
  subtotal: number;
  add: (item: Omit<CartItem, "key" | "quantity"> & { quantity?: number }) => void;
  remove: (key: string) => void;
  setQuantity: (key: string, quantity: number) => void;
  clear: () => void;
  ready: boolean;
};

const KEY = "tcc_cart_v1";
const Ctx = createContext<CartContext | null>(null);

function itemKey(item: { slug: string; months?: number; customTag?: string; customPrefix?: string }): string {
  return [item.slug, item.months ?? 0, item.customTag ?? "", (item.customPrefix ?? "").slice(0, 24)].join("::");
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CartItem[];
        if (Array.isArray(parsed)) setItems(parsed.filter((i) => i && typeof i.slug === "string"));
      }
    } catch {
      /* ignore corrupt storage */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      /* storage full / private mode */
    }
  }, [items, ready]);

  const add = useCallback<CartContext["add"]>((input) => {
    setItems((prev) => {
      const key = itemKey(input);
      const existing = prev.find((i) => i.key === key);
      if (existing) {
        return prev.map((i) => (i.key === key ? { ...i, quantity: Math.min(10, i.quantity + (input.quantity ?? 1)) } : i));
      }
      return [...prev, { ...input, key, quantity: Math.min(10, input.quantity ?? 1) }];
    });
  }, []);

  const remove = useCallback((key: string) => setItems((prev) => prev.filter((i) => i.key !== key)), []);
  const setQuantity = useCallback(
    (key: string, quantity: number) =>
      setItems((prev) => prev.map((i) => (i.key === key ? { ...i, quantity: Math.max(1, Math.min(10, quantity)) } : i))),
    [],
  );
  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContext>(() => {
    const count = items.reduce((n, i) => n + i.quantity, 0);
    const subtotal = items.reduce((n, i) => n + i.unitPrice * i.quantity, 0);
    return { items, count, subtotal, add, remove, setQuantity, clear, ready };
  }, [items, add, remove, setQuantity, clear, ready]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart(): CartContext {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // A component used outside the provider should not crash the page.
    return {
      items: [],
      count: 0,
      subtotal: 0,
      add: () => undefined,
      remove: () => undefined,
      setQuantity: () => undefined,
      clear: () => undefined,
      ready: false,
    };
  }
  return ctx;
}

export function priceToman(n: number): string {
  return `${new Intl.NumberFormat("fa-IR").format(Math.round(n))} تومان`;
}
