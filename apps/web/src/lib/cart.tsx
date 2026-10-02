"use client";

import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import type { Product } from "./types";

export interface CartLine {
  productId: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  type: Product["type"];
  unitPriceCents: number;
  quantity: number;
  maxQuantity: number;
}

export type CartAction =
  | { type: "add"; product: Product; quantity?: number }
  | { type: "setQuantity"; productId: string; quantity: number }
  | { type: "remove"; productId: string }
  | { type: "clear" }
  | { type: "hydrate"; lines: CartLine[] };

export const MAX_PER_LINE = 20;

const isValidLine = (l: CartLine) =>
  typeof l?.productId === "string" &&
  typeof l.slug === "string" &&
  Number.isInteger(l.unitPriceCents) &&
  l.unitPriceCents >= 0 &&
  Number.isInteger(l.maxQuantity) &&
  Number.isInteger(l.quantity) &&
  l.quantity > 0 &&
  l.quantity <= l.maxQuantity;

export function cartReducer(state: CartLine[], action: CartAction): CartLine[] {
  switch (action.type) {
    case "add": {
      const { product } = action;
      const max = Math.min(MAX_PER_LINE, product.stock);
      if (max <= 0) return state;
      const qty = action.quantity ?? 1;
      const existing = state.find((l) => l.productId === product.id);
      if (existing) {
        return state.map((l) =>
          l.productId === product.id
            ? { ...l, quantity: Math.min(max, l.quantity + qty), maxQuantity: max, unitPriceCents: product.priceCents }
            : l,
        );
      }
      return [
        ...state,
        {
          productId: product.id,
          slug: product.slug,
          name: product.name,
          imageUrl: product.imageUrl,
          type: product.type,
          unitPriceCents: product.priceCents,
          quantity: Math.min(max, qty),
          maxQuantity: max,
        },
      ];
    }
    case "setQuantity":
      if (action.quantity <= 0) return state.filter((l) => l.productId !== action.productId);
      return state.map((l) => (l.productId === action.productId ? { ...l, quantity: Math.min(l.maxQuantity, action.quantity) } : l));
    case "remove":
      return state.filter((l) => l.productId !== action.productId);
    case "clear":
      return [];
    case "hydrate":
      return Array.isArray(action.lines) ? action.lines.filter(isValidLine) : [];
  }
}

export const cartSubtotal = (lines: CartLine[]) => lines.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0);
export const cartCount = (lines: CartLine[]) => lines.reduce((s, l) => s + l.quantity, 0);

const STORAGE_KEY = "phygital.cart.v1";

interface CartContextValue {
  lines: CartLine[];
  count: number;
  subtotalCents: number;
  dispatch: (action: CartAction) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, dispatch] = useReducer(cartReducer, []);
  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) dispatch({ type: "hydrate", lines: JSON.parse(raw) as CartLine[] });
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (hydrated.current) localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines]);

  const value = useMemo(
    () => ({ lines, count: cartCount(lines), subtotalCents: cartSubtotal(lines), dispatch }),
    [lines],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
