import { LOYALTY_TIERS } from "@phygital/shared";
import type { LoyaltyStatus, Product } from "@/lib/types";

export const product = (overrides: Partial<Product> = {}): Product => ({
  id: "p1",
  slug: "cold-brew-kit",
  name: "Cold Brew Kit",
  description: "Brew at home",
  type: "PHYSICAL",
  category: "coffee",
  priceCents: 4_000,
  currency: "USD",
  stock: 5,
  imageUrl: null,
  tokenId: 1,
  twinEnabled: true,
  active: true,
  ...overrides,
});

export const loyalty = (twinCount: number, overrides: Partial<LoyaltyStatus> = {}): LoyaltyStatus => {
  const tierIndex = LOYALTY_TIERS.findLastIndex((t) => twinCount >= t.minTwins);
  const tier = LOYALTY_TIERS[tierIndex]!;
  const next = LOYALTY_TIERS[tierIndex + 1];
  return {
    walletAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    twinCount,
    source: "onchain",
    tier,
    next: next ? { tier: next, twinsNeeded: next.minTwins - twinCount } : null,
    perks: LOYALTY_TIERS.flatMap((t) => t.perks.map((perk) => ({ tierId: t.id, tierName: t.name, perk, unlocked: twinCount >= t.minTwins }))),
    ...overrides,
  };
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
