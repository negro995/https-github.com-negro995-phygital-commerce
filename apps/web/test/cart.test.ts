import { describe, expect, it } from "vitest";
import { MAX_PER_LINE, cartCount, cartReducer, cartSubtotal } from "@/lib/cart";
import { product } from "./fixtures";

describe("cartReducer", () => {
  it("adds a product and merges repeated adds into one line", () => {
    let state = cartReducer([], { type: "add", product: product() });
    state = cartReducer(state, { type: "add", product: product(), quantity: 2 });
    expect(state).toHaveLength(1);
    expect(state[0]).toMatchObject({ productId: "p1", quantity: 3, unitPriceCents: 4_000 });
  });

  it("caps physical quantity at available stock", () => {
    const state = cartReducer([], { type: "add", product: product({ stock: 2 }), quantity: 5 });
    expect(state[0]!.quantity).toBe(2);
  });

  it("caps digital quantity at the per-line maximum", () => {
    const state = cartReducer([], { type: "add", product: product({ type: "DIGITAL", stock: 999 }), quantity: 50 });
    expect(state[0]!.quantity).toBe(MAX_PER_LINE);
  });

  it("ignores sold-out products", () => {
    expect(cartReducer([], { type: "add", product: product({ stock: 0 }) })).toEqual([]);
  });

  it("removes a line when quantity drops to zero", () => {
    const state = cartReducer([], { type: "add", product: product() });
    expect(cartReducer(state, { type: "setQuantity", productId: "p1", quantity: 0 })).toEqual([]);
  });

  it("computes subtotal and count", () => {
    let state = cartReducer([], { type: "add", product: product(), quantity: 2 });
    state = cartReducer(state, { type: "add", product: product({ id: "p2", slug: "beans", priceCents: 1_250 }) });
    expect(cartSubtotal(state)).toBe(9_250);
    expect(cartCount(state)).toBe(3);
  });

  it("drops malformed lines when hydrating from storage", () => {
    const state = cartReducer([], {
      type: "hydrate",
      lines: [{ productId: "p1", slug: "x", name: "X", imageUrl: null, type: "PHYSICAL", unitPriceCents: 100, quantity: -3, maxQuantity: 5 }],
    });
    expect(state).toEqual([]);
  });
});
