export type LoyaltyTierId = "EXPLORER" | "INSIDER" | "VIP" | "LEGEND";

export interface LoyaltyTier {
  id: LoyaltyTierId;
  name: string;
  /** Minimum number of Digital Twin NFTs held to unlock the tier. */
  minTwins: number;
  /** Automatic discount in basis points (100 bps = 1%). */
  discountBps: number;
  perks: string[];
}

export const LOYALTY_TIERS: readonly LoyaltyTier[] = [
  {
    id: "EXPLORER",
    name: "Explorer",
    minTwins: 0,
    discountBps: 0,
    perks: ["Digital Twin NFT with every purchase", "AI concierge recommendations"],
  },
  {
    id: "INSIDER",
    name: "Insider",
    minTwins: 1,
    discountBps: 500,
    perks: ["5% off every order", "Early access to drops"],
  },
  {
    id: "VIP",
    name: "VIP",
    minTwins: 5,
    discountBps: 1000,
    perks: ["10% off every order", "Free shipping", "Members-only products"],
  },
  {
    id: "LEGEND",
    name: "Legend",
    minTwins: 15,
    discountBps: 1500,
    perks: ["15% off every order", "Private in-store events", "Priority support"],
  },
] as const;

export function tierForTwinCount(twinCount: number): LoyaltyTier {
  const count = Number.isFinite(twinCount) && twinCount > 0 ? Math.floor(twinCount) : 0;
  let current = LOYALTY_TIERS[0]!;
  for (const tier of LOYALTY_TIERS) {
    if (count >= tier.minTwins) current = tier;
  }
  return current;
}

export function nextTier(twinCount: number): { tier: LoyaltyTier; twinsNeeded: number } | null {
  const current = tierForTwinCount(twinCount);
  const idx = LOYALTY_TIERS.findIndex((t) => t.id === current.id);
  const next = LOYALTY_TIERS[idx + 1];
  if (!next) return null;
  return { tier: next, twinsNeeded: Math.max(0, next.minTwins - Math.floor(Math.max(0, twinCount))) };
}

export function isTierAtLeast(tier: LoyaltyTierId, required: LoyaltyTierId): boolean {
  const order = LOYALTY_TIERS.map((t) => t.id);
  return order.indexOf(tier) >= order.indexOf(required);
}
