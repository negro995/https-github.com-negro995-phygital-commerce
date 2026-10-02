import {
  erc20Abi,
  isAddressEqual,
  parseEventLogs,
  TransactionReceiptNotFoundError,
  type Address,
  type Hash,
  type PublicClient,
} from "viem";

export interface VerifyTransferParams {
  txHash: Hash;
  token: Address;
  recipient: Address;
  minAmount: bigint;
  minConfirmations?: number;
}

export type VerifyTransferResult =
  | { ok: true; from: Address; amount: bigint; blockNumber: bigint }
  | {
      ok: false;
      reason: "pending" | "reverted" | "no_matching_transfer" | "insufficient_amount" | "insufficient_confirmations";
      message: string;
    };

/** Verifies an ERC-20 (e.g. USDC) payment by inspecting the Transfer logs of a transaction receipt. */
export async function verifyErc20Transfer(
  publicClient: PublicClient,
  { txHash, token, recipient, minAmount, minConfirmations = 1 }: VerifyTransferParams,
): Promise<VerifyTransferResult> {
  let receipt;
  try {
    receipt = await publicClient.getTransactionReceipt({ hash: txHash });
  } catch (err) {
    if (err instanceof TransactionReceiptNotFoundError) {
      return { ok: false, reason: "pending", message: "La transacción todavía no se confirmó en un bloque" };
    }
    throw err;
  }
  if (receipt.status !== "success") return { ok: false, reason: "reverted", message: "La transacción fue revertida" };

  const transfers = parseEventLogs({ abi: erc20Abi, eventName: "Transfer", logs: receipt.logs }).filter(
    (log) => isAddressEqual(log.address, token) && isAddressEqual(log.args.to, recipient),
  );
  if (transfers.length === 0) {
    return { ok: false, reason: "no_matching_transfer", message: "No encontramos una transferencia del token a la wallet del comercio" };
  }
  const amount = transfers.reduce((sum, log) => sum + log.args.value, 0n);
  if (amount < minAmount) {
    return { ok: false, reason: "insufficient_amount", message: `Monto insuficiente: recibimos ${amount}, se esperaba ${minAmount} (unidades mínimas del token)` };
  }

  const head = await publicClient.getBlockNumber();
  const confirmations = Number(head - receipt.blockNumber) + 1;
  if (confirmations < minConfirmations) {
    return {
      ok: false,
      reason: "insufficient_confirmations",
      message: `${confirmations}/${minConfirmations} confirmaciones`,
    };
  }
  return { ok: true, from: transfers[0]!.args.from, amount, blockNumber: receipt.blockNumber };
}
