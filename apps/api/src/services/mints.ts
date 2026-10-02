import type { NftMint } from "@phygital/db";
import { backoffDelayMs } from "@phygital/web3";
import type { Address, Hash } from "viem";
import type { AppDeps } from "../deps";
import { errorMessage } from "../lib/util";

type MintDeps = Pick<AppDeps, "db" | "chain" | "config" | "logger">;

const WAIT_FOR_CONFIG_MS = 5 * 60_000;
const PENDING_RECHECK_MS = 30_000;
const STUCK_TX_MS = 10 * 60_000;
const LEASE_MS = 2 * 60_000;

const after = (ms: number) => new Date(Date.now() + ms);

/**
 * Advances a single mint job one step. Never throws: every failure is recorded on the job so the
 * storefront can show an accurate fallback state ("queued", "retrying", "failed").
 */
export async function processMintJob(deps: MintDeps, job: NftMint): Promise<NftMint> {
  const { db, chain, config, logger } = deps;
  const update = (data: Partial<NftMint>) => db.nftMint.update({ where: { id: job.id }, data });

  if (!chain.minter) {
    return update({ lastError: "On-chain minting is not configured yet — queued", nextAttemptAt: after(WAIT_FOR_CONFIG_MS) });
  }

  const wallet = job.walletAddress ?? (await db.user.findUnique({ where: { id: job.userId } }))?.walletAddress;
  if (!wallet) {
    return update({ lastError: "Waiting for the customer's wallet", nextAttemptAt: after(WAIT_FOR_CONFIG_MS) });
  }

  try {
    if (job.status === "SUBMITTED" && job.txHash) {
      const confirmation = await chain.minter.confirm(job.txHash as Hash, 5_000, config.MINT_CONFIRMATIONS);
      if (confirmation.status === "confirmed") {
        return update({ status: "CONFIRMED", confirmedAt: new Date(), lastError: null });
      }
      if (confirmation.status === "pending" && Date.now() - job.updatedAt.getTime() < STUCK_TX_MS) {
        return update({ nextAttemptAt: after(PENDING_RECHECK_MS) });
      }
      if (await chain.minter.isMinted(job.mintRef)) {
        return update({ status: "CONFIRMED", confirmedAt: new Date(), lastError: null });
      }
      logger.warn("Mint tx reverted or stuck; resubmitting", { mintId: job.id, txHash: job.txHash, confirmation });
    }

    const attempts = job.attempts + 1;
    const result = await chain.minter.submit({ to: wallet as Address, tokenId: job.tokenId, mintRef: job.mintRef });

    if (result.status === "already_minted") {
      return update({ status: "CONFIRMED", confirmedAt: new Date(), walletAddress: wallet, lastError: null, attempts });
    }
    if (result.status === "error") {
      const failed = result.kind === "permanent" || attempts >= config.MINT_MAX_ATTEMPTS;
      logger.warn("Mint attempt failed", { mintId: job.id, attempts, kind: result.kind, error: result.message });
      return update({
        status: failed ? "FAILED" : "PENDING",
        attempts,
        lastError: result.message,
        walletAddress: wallet,
        nextAttemptAt: after(backoffDelayMs(attempts)),
      });
    }

    await update({ status: "SUBMITTED", txHash: result.txHash, attempts, walletAddress: wallet, lastError: null });
    const confirmation = await chain.minter.confirm(result.txHash, 30_000, config.MINT_CONFIRMATIONS);
    if (confirmation.status === "confirmed") {
      return update({ status: "CONFIRMED", confirmedAt: new Date() });
    }
    return update({
      nextAttemptAt: after(PENDING_RECHECK_MS),
      lastError: confirmation.status === "pending" ? null : `Transaction ${confirmation.status}`,
    });
  } catch (err) {
    logger.error("Unexpected mint error", { mintId: job.id, error: errorMessage(err) });
    const attempts = job.attempts + 1;
    return update({
      status: attempts >= config.MINT_MAX_ATTEMPTS ? "FAILED" : job.status === "SUBMITTED" ? "SUBMITTED" : "PENDING",
      attempts,
      lastError: errorMessage(err),
      nextAttemptAt: after(backoffDelayMs(attempts)),
    });
  }
}

/** Processes due jobs sequentially (single minter key => sequential nonces). */
export async function processDueMints(deps: MintDeps, limit = 10): Promise<number> {
  const due = await deps.db.nftMint.findMany({
    where: { status: { in: ["PENDING", "SUBMITTED"] }, nextAttemptAt: { lte: new Date() } },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
  });
  let processed = 0;
  for (const job of due) {
    // Lease the job so concurrent workers (multiple API replicas) skip it.
    const leased = await deps.db.nftMint.updateMany({
      where: { id: job.id, updatedAt: job.updatedAt },
      data: { nextAttemptAt: after(LEASE_MS) },
    });
    if (leased.count === 0) continue;
    const fresh = await deps.db.nftMint.findUnique({ where: { id: job.id } });
    if (!fresh) continue;
    await processMintJob(deps, fresh);
    processed++;
  }
  return processed;
}

export function startMintWorker(deps: MintDeps, intervalMs: number) {
  let running = false;
  let again = false;
  const tick = async () => {
    if (running) {
      again = true;
      return;
    }
    running = true;
    try {
      do {
        again = false;
        await processDueMints(deps);
      } while (again);
    } catch (err) {
      deps.logger.error("Mint worker tick failed", { error: errorMessage(err) });
    } finally {
      running = false;
    }
  };
  const timer = intervalMs > 0 ? setInterval(tick, intervalMs) : null;
  timer?.unref();
  return {
    kick: () => void tick(),
    stop: () => timer && clearInterval(timer),
  };
}

export async function retryMint(deps: Pick<AppDeps, "db" | "kickMintWorker">, id: string) {
  const mint = await deps.db.nftMint.update({
    where: { id },
    data: { status: "PENDING", attempts: 0, lastError: null, nextAttemptAt: new Date() },
  });
  deps.kickMintWorker();
  return mint;
}
