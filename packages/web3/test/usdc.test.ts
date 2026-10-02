import { encodeAbiParameters, erc20Abi, encodeEventTopics, TransactionReceiptNotFoundError, type PublicClient } from "viem";
import { describe, expect, it, vi } from "vitest";
import { verifyErc20Transfer } from "../src/usdc";

const token = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const merchant = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const payer = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
const txHash = `0x${"cd".repeat(32)}` as const;

function transferLog(to: `0x${string}`, value: bigint, address: `0x${string}` = token) {
  return {
    address,
    topics: encodeEventTopics({ abi: erc20Abi, eventName: "Transfer", args: { from: payer, to } }),
    data: encodeAbiParameters([{ type: "uint256" }], [value]),
    blockNumber: 100n,
    transactionHash: txHash,
    logIndex: 0,
    blockHash: `0x${"00".repeat(32)}`,
    transactionIndex: 0,
    removed: false,
  };
}

function client(receipt: unknown, head = 105n) {
  return {
    getTransactionReceipt: vi.fn().mockImplementation(async () => {
      if (receipt instanceof Error) throw receipt;
      return receipt;
    }),
    getBlockNumber: vi.fn().mockResolvedValue(head),
  } as unknown as PublicClient;
}

const params = { txHash, token, recipient: merchant, minAmount: 10_000_000n, minConfirmations: 2 } as const;

describe("verifyErc20Transfer", () => {
  it("accepts a sufficient, confirmed transfer to the merchant", async () => {
    const result = await verifyErc20Transfer(
      client({ status: "success", blockNumber: 100n, logs: [transferLog(merchant, 10_000_000n)] }),
      params,
    );
    expect(result).toEqual({ ok: true, from: payer, amount: 10_000_000n, blockNumber: 100n });
  });

  it("reports pending when the receipt does not exist yet", async () => {
    const result = await verifyErc20Transfer(client(new TransactionReceiptNotFoundError({ hash: txHash })), params);
    expect(result).toMatchObject({ ok: false, reason: "pending" });
  });

  it("rejects transfers to someone else or from another token", async () => {
    const result = await verifyErc20Transfer(
      client({
        status: "success",
        blockNumber: 100n,
        logs: [transferLog(payer, 10_000_000n), transferLog(merchant, 10_000_000n, payer)],
      }),
      params,
    );
    expect(result).toMatchObject({ ok: false, reason: "no_matching_transfer" });
  });

  it("rejects underpayment", async () => {
    const result = await verifyErc20Transfer(
      client({ status: "success", blockNumber: 100n, logs: [transferLog(merchant, 9_999_999n)] }),
      params,
    );
    expect(result).toMatchObject({ ok: false, reason: "insufficient_amount" });
  });

  it("waits for confirmations", async () => {
    const result = await verifyErc20Transfer(
      client({ status: "success", blockNumber: 100n, logs: [transferLog(merchant, 10_000_000n)] }, 100n),
      params,
    );
    expect(result).toMatchObject({ ok: false, reason: "insufficient_confirmations" });
  });

  it("rejects reverted transactions", async () => {
    const result = await verifyErc20Transfer(client({ status: "reverted", blockNumber: 100n, logs: [] }), params);
    expect(result).toMatchObject({ ok: false, reason: "reverted" });
  });
});
