import type { User } from "@phygital/db";
import { LOYALTY_TIERS, nextTier, tierForTwinCount, type LoyaltyTier } from "@phygital/shared";
import type { Address } from "viem";
import type { AppDeps } from "../deps";
import { errorMessage, withTimeout } from "../lib/util";

export interface LoyaltyStatus {
  walletAddress: string | null;
  twinCount: number;
  /** `onchain` = read from the PhygitalTwin contract; `database` = fallback from confirmed mint records. */
  source: "onchain" | "database";
  tier: LoyaltyTier;
  next: { tier: LoyaltyTier; twinsNeeded: number } | null;
  perks: Array<{ tierId: LoyaltyTier["id"]; tierName: string; perk: string; unlocked: boolean }>;
}

export async function getLoyaltyStatus(
  deps: Pick<AppDeps, "db" | "chain" | "logger">,
  user: Pick<User, "id" | "walletAddress">,
): Promise<LoyaltyStatus> {
  let twinCount: number | null = null;
  let source: LoyaltyStatus["source"] = "database";

  if (user.walletAddress && deps.chain.readTwinCount) {
    try {
      twinCount = await withTimeout(deps.chain.readTwinCount(user.walletAddress as Address), 4_000, "twinCount read");
      source = "onchain";
    } catch (err) {
      deps.logger.warn("On-chain loyalty read failed, falling back to database", { error: errorMessage(err) });
    }
  }
  if (twinCount === null) {
    twinCount = await deps.db.nftMint.count({ where: { userId: user.id, status: "CONFIRMED" } });
  }

  const tier = tierForTwinCount(twinCount);
  return {
    walletAddress: user.walletAddress,
    twinCount,
    source,
    tier,
    next: nextTier(twinCount),
    perks: LOYALTY_TIERS.flatMap((t) =>
      t.perks.map((perk) => ({ tierId: t.id, tierName: t.name, perk, unlocked: twinCount >= t.minTwins })),
    ),
  };
}
