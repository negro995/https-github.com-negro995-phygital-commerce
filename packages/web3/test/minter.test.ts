import type { PublicClient } from "viem";
import { HttpRequestError } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { describe, expect, it, vi } from "vitest";
import type { MinterWalletClient } from "../src/clients";
import { TwinMinter } from "../src/minter";
import { toMintRefHash } from "../src/mintRef";

const account = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
const contract = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const to = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const hash = `0x${"ab".repeat(32)}` as const;

function setup(overrides: Partial<Record<"readContract" | "simulateContract" | "waitForTransactionReceipt", unknown>> = {}) {
  const publicClient = {
    readContract: vi.fn().mockResolvedValue(false),
    simulateContract: vi.fn().mockResolvedValue({ request: { functionName: "mintTwin" } }),
    waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: "success", blockNumber: 10n }),
    ...overrides,
  };
  const walletClient = { account, writeContract: vi.fn().mockResolvedValue(hash) };
  const minter = new TwinMinter(
    publicClient as unknown as PublicClient,
    walletClient as unknown as MinterWalletClient,
    contract,
  );
  return { minter, publicClient, walletClient };
}

describe("TwinMinter", () => {
  it("simulates and submits a mint with the hashed mintRef", async () => {
    const { minter, publicClient, walletClient } = setup();
    const result = await minter.submit({ to, tokenId: 3, mintRef: "order:1:item:1:0" });
    expect(result).toEqual({ status: "submitted", txHash: hash });
    expect(publicClient.simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({ args: [to, 3n, toMintRefHash("order:1:item:1:0")], functionName: "mintTwin" }),
    );
    expect(walletClient.writeContract).toHaveBeenCalledOnce();
  });

  it("skips submission when the mintRef was already used on-chain", async () => {
    const { minter, walletClient } = setup({ readContract: vi.fn().mockResolvedValue(true) });
    expect(await minter.submit({ to, tokenId: 1, mintRef: "x" })).toEqual({ status: "already_minted" });
    expect(walletClient.writeContract).not.toHaveBeenCalled();
  });

  it("returns a retryable error when the RPC is down", async () => {
    const { minter } = setup({
      readContract: vi.fn().mockRejectedValue(new HttpRequestError({ url: "http://rpc", status: 502 })),
    });
    const result = await minter.submit({ to, tokenId: 1, mintRef: "x" });
    expect(result).toMatchObject({ status: "error", kind: "retryable" });
  });

  it("maps receipts to confirmation states", async () => {
    expect(await setup().minter.confirm(hash)).toEqual({ status: "confirmed", blockNumber: 10n });
    const reverted = setup({ waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: "reverted" }) });
    expect(await reverted.minter.confirm(hash)).toEqual({ status: "reverted" });
    const timeout = Object.assign(new Error("timed out"), { name: "WaitForTransactionReceiptTimeoutError" });
    const pending = setup({ waitForTransactionReceipt: vi.fn().mockRejectedValue(timeout) });
    expect(await pending.minter.confirm(hash)).toEqual({ status: "pending" });
  });
});
