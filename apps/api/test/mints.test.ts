import type { NftMint } from "@phygital/db";
import { describe, expect, it, vi } from "vitest";
import { processMintJob } from "../src/services/mints";
import type { MinterPort } from "../src/services/chain";
import { fakeDb, makeDeps, mintJob, offlineChain } from "./helpers";

function setup(minter: Partial<MinterPort> | null, job: NftMint = mintJob()) {
  let state = { ...job };
  const update = vi.fn(async ({ data }: { data: Partial<NftMint> }) => (state = { ...state, ...data }));
  const db = fakeDb({ nftMint: { update }, user: { findUnique: vi.fn(async () => null) } });
  const fullMinter: MinterPort | null = minter
    ? {
        submit: vi.fn(async () => ({ status: "submitted" as const, txHash: "0xabc" as const })),
        confirm: vi.fn(async () => ({ status: "confirmed" as const, blockNumber: 1n })),
        isMinted: vi.fn(async () => false),
        ...minter,
      }
    : null;
  const deps = makeDeps({ db, chain: offlineChain({ minter: fullMinter }) });
  return { deps, update, minter: fullMinter, run: () => processMintJob(deps, state) };
}

describe("processMintJob", () => {
  it("keeps the job queued when Web3 is not configured", async () => {
    const { run } = setup(null);
    const res = await run();
    expect(res.status).toBe("PENDING");
    expect(res.lastError).toMatch(/not configured/);
    expect(res.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("waits when the customer has no wallet yet", async () => {
    const { run, minter } = setup({}, mintJob({ walletAddress: null }));
    const res = await run();
    expect(res.status).toBe("PENDING");
    expect(res.lastError).toMatch(/wallet/);
    expect(minter!.submit).not.toHaveBeenCalled();
  });

  it("submits and confirms a mint", async () => {
    const { run } = setup({});
    const res = await run();
    expect(res).toMatchObject({ status: "CONFIRMED", txHash: "0xabc", attempts: 1, lastError: null });
    expect(res.confirmedAt).toBeInstanceOf(Date);
  });

  it("treats an already-used mint ref as confirmed (idempotent retry)", async () => {
    const { run } = setup({ submit: vi.fn(async () => ({ status: "already_minted" as const })) });
    expect((await run()).status).toBe("CONFIRMED");
  });

  it("schedules a retry with backoff on transient errors", async () => {
    const { run } = setup({ submit: vi.fn(async () => ({ status: "error" as const, kind: "retryable" as const, message: "RPC timeout" })) });
    const res = await run();
    expect(res).toMatchObject({ status: "PENDING", attempts: 1, lastError: "RPC timeout" });
    expect(res.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("fails permanently on non-retryable errors", async () => {
    const { run } = setup({ submit: vi.fn(async () => ({ status: "error" as const, kind: "permanent" as const, message: "missing role" })) });
    expect((await run()).status).toBe("FAILED");
  });

  it("gives up after MINT_MAX_ATTEMPTS", async () => {
    const { run } = setup(
      { submit: vi.fn(async () => ({ status: "error" as const, kind: "retryable" as const, message: "nonce" })) },
      mintJob({ attempts: 7 }),
    );
    expect((await run()).status).toBe("FAILED");
  });

  it("keeps a submitted tx pending while it is still recent", async () => {
    const { run, minter } = setup(
      { confirm: vi.fn(async () => ({ status: "pending" as const })) },
      mintJob({ status: "SUBMITTED", txHash: "0xdef", attempts: 1 }),
    );
    const res = await run();
    expect(res.status).toBe("SUBMITTED");
    expect(minter!.submit).not.toHaveBeenCalled();
  });

  it("resubmits a reverted tx whose mint ref was never used", async () => {
    const { run, minter } = setup(
      { confirm: vi.fn().mockResolvedValueOnce({ status: "reverted" }).mockResolvedValueOnce({ status: "confirmed", blockNumber: 2n }) },
      mintJob({ status: "SUBMITTED", txHash: "0xdef", attempts: 1 }),
    );
    const res = await run();
    expect(minter!.submit).toHaveBeenCalledOnce();
    expect(res).toMatchObject({ status: "CONFIRMED", attempts: 2 });
  });

  it("never throws: unexpected errors are recorded on the job", async () => {
    const { run } = setup({ submit: vi.fn(async () => Promise.reject(new Error("boom"))) });
    const res = await run();
    expect(res).toMatchObject({ status: "PENDING", lastError: "boom", attempts: 1 });
  });
});
