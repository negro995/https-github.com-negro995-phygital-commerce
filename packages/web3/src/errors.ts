import {
  BaseError,
  ContractFunctionRevertedError,
  InsufficientFundsError,
  UserRejectedRequestError,
} from "viem";

export type Web3ErrorKind =
  /** The mint reference was already consumed on-chain — treat as success. */
  | "already_minted"
  /** Transient: RPC outage, timeout, nonce race, gas spike, unfunded minter. Retry with backoff. */
  | "retryable"
  /** Deterministic failure (e.g. missing role, bad recipient). Retrying will not help. */
  | "permanent"
  /** Wallet holder rejected the request (client side). */
  | "user_rejected";

export interface ClassifiedWeb3Error {
  kind: Web3ErrorKind;
  message: string;
}

const PERMANENT_REVERTS = new Set(["AccessControlUnauthorizedAccount", "InvalidRecipient", "Soulbound"]);

export function classifyWeb3Error(err: unknown): ClassifiedWeb3Error {
  if (err instanceof BaseError) {
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      const name = revert.data?.errorName ?? revert.reason ?? "unknown";
      if (name === "MintRefAlreadyUsed") return { kind: "already_minted", message: "Mint reference already used" };
      if (PERMANENT_REVERTS.has(name)) return { kind: "permanent", message: `Contract reverted: ${name}` };
      return { kind: "permanent", message: `Contract reverted: ${name}` };
    }
    if (err.walk((e) => e instanceof UserRejectedRequestError)) {
      return { kind: "user_rejected", message: "Request rejected in wallet" };
    }
    if (err.walk((e) => e instanceof InsufficientFundsError)) {
      return { kind: "retryable", message: "Minter wallet has insufficient funds for gas" };
    }
    return { kind: "retryable", message: err.shortMessage || err.message };
  }
  const message = err instanceof Error ? err.message : String(err);
  return { kind: "retryable", message };
}

/** Exponential backoff with jitter, capped. attempt is 1-based. */
export function backoffDelayMs(attempt: number, baseMs = 15_000, maxMs = 30 * 60_000, random = Math.random): number {
  const exp = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt - 1));
  return Math.round(exp / 2 + random() * (exp / 2));
}
