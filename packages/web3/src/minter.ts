import type { Address, Hash, PublicClient } from "viem";
import { phygitalTwinAbi } from "./abi/phygitalTwin";
import type { MinterWalletClient } from "./clients";
import { classifyWeb3Error, type Web3ErrorKind } from "./errors";
import { toMintRefHash } from "./mintRef";

export interface MintRequest {
  to: Address;
  tokenId: number;
  mintRef: string;
}

export type SubmitResult =
  | { status: "submitted"; txHash: Hash }
  | { status: "already_minted" }
  | { status: "error"; kind: Exclude<Web3ErrorKind, "already_minted">; message: string };

export type ConfirmResult =
  | { status: "confirmed"; blockNumber: bigint }
  | { status: "reverted" }
  | { status: "pending" }
  | { status: "error"; message: string };

export class TwinMinter {
  constructor(
    private readonly publicClient: PublicClient,
    private readonly walletClient: MinterWalletClient,
    private readonly contract: Address,
  ) {}

  get minterAddress(): Address {
    return this.walletClient.account.address;
  }

  async isMinted(mintRef: string): Promise<boolean> {
    return this.publicClient.readContract({
      address: this.contract,
      abi: phygitalTwinAbi,
      functionName: "usedMintRefs",
      args: [toMintRefHash(mintRef)],
    });
  }

  /** Simulates then broadcasts a mint. Safe to call repeatedly thanks to on-chain mintRef idempotency. */
  async submit(req: MintRequest): Promise<SubmitResult> {
    try {
      if (await this.isMinted(req.mintRef)) return { status: "already_minted" };
      const { request } = await this.publicClient.simulateContract({
        account: this.walletClient.account,
        address: this.contract,
        abi: phygitalTwinAbi,
        functionName: "mintTwin",
        args: [req.to, BigInt(req.tokenId), toMintRefHash(req.mintRef)],
      });
      const txHash = await this.walletClient.writeContract(request);
      return { status: "submitted", txHash };
    } catch (err) {
      const classified = classifyWeb3Error(err);
      if (classified.kind === "already_minted") return { status: "already_minted" };
      return { status: "error", kind: classified.kind, message: classified.message };
    }
  }

  async confirm(txHash: Hash, timeoutMs = 60_000, confirmations = 1): Promise<ConfirmResult> {
    try {
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: timeoutMs,
        confirmations,
      });
      return receipt.status === "success"
        ? { status: "confirmed", blockNumber: receipt.blockNumber }
        : { status: "reverted" };
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      if (name === "WaitForTransactionReceiptTimeoutError" || name === "TransactionReceiptNotFoundError") {
        return { status: "pending" };
      }
      return { status: "error", message: classifyWeb3Error(err).message };
    }
  }
}
