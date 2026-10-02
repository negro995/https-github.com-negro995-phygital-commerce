export interface PricedLine {
  productId: string;
  unitPriceCents: number;
  quantity: number;
}

export interface OrderTotals {
  subtotalCents: number;
  discountBps: number;
  discountCents: number;
  totalCents: number;
}

export const MAX_DISCOUNT_BPS = 5000;

/** Computes order totals in integer cents. Discount is rounded down so we never over-discount. */
export function computeOrderTotals(lines: PricedLine[], discountBps: number): OrderTotals {
  for (const line of lines) {
    if (!Number.isInteger(line.unitPriceCents) || line.unitPriceCents < 0) {
      throw new RangeError(`Invalid unit price for product ${line.productId}`);
    }
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new RangeError(`Invalid quantity for product ${line.productId}`);
    }
  }
  const bps = Math.min(Math.max(0, Math.floor(discountBps)), MAX_DISCOUNT_BPS);
  const subtotalCents = lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
  const discountCents = Math.floor((subtotalCents * bps) / 10_000);
  return { subtotalCents, discountBps: bps, discountCents, totalCents: subtotalCents - discountCents };
}

/** Converts integer cents (2 decimals) to USDC base units (6 decimals). */
export function centsToUsdcUnits(cents: number): bigint {
  return BigInt(cents) * 10_000n;
}
