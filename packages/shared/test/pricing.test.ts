import { describe, expect, it } from "vitest";
import { centsToUsdcUnits, computeOrderTotals } from "../src/pricing";

describe("computeOrderTotals", () => {
  it("applies the discount in integer cents, rounding down", () => {
    const totals = computeOrderTotals(
      [
        { productId: "a", unitPriceCents: 1999, quantity: 2 },
        { productId: "b", unitPriceCents: 501, quantity: 1 },
      ],
      1000,
    );
    expect(totals).toEqual({ subtotalCents: 4499, discountBps: 1000, discountCents: 449, totalCents: 4050 });
  });

  it("caps the discount", () => {
    const totals = computeOrderTotals([{ productId: "a", unitPriceCents: 1000, quantity: 1 }], 9000);
    expect(totals.discountBps).toBe(5000);
    expect(totals.totalCents).toBe(500);
  });

  it("rejects invalid lines", () => {
    expect(() => computeOrderTotals([{ productId: "a", unitPriceCents: 10.5, quantity: 1 }], 0)).toThrow(RangeError);
    expect(() => computeOrderTotals([{ productId: "a", unitPriceCents: 100, quantity: 0 }], 0)).toThrow(RangeError);
  });
});

describe("centsToUsdcUnits", () => {
  it("converts 2-decimal cents to 6-decimal USDC units", () => {
    expect(centsToUsdcUnits(1234)).toBe(12_340_000n);
  });
});
