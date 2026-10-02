import { keccak256, toBytes, type Hex } from "viem";

/** Deterministic on-chain idempotency key for a mint job. */
export function toMintRefHash(mintRef: string): Hex {
  return keccak256(toBytes(mintRef));
}
