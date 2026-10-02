import {
  createChainClients,
  explorerTxUrl,
  readTwinCount,
  TwinMinter,
  verifyErc20Transfer,
  type ConfirmResult,
  type MintRequest,
  type SubmitResult,
  type VerifyTransferParams,
  type VerifyTransferResult,
} from "@phygital/web3";
import { isAddress, type Address, type Hash } from "viem";
import type { AppConfig } from "../config";
import type { Logger } from "../lib/logger";

export interface MinterPort {
  submit(req: MintRequest): Promise<SubmitResult>;
  confirm(txHash: Hash, timeoutMs?: number, confirmations?: number): Promise<ConfirmResult>;
  isMinted(mintRef: string): Promise<boolean>;
}

export interface ChainService {
  chainId: number;
  /** Null when minting is not configured (no contract or minter key): mints stay queued. */
  minter: MinterPort | null;
  /** Null when no contract is configured. Throws when the RPC is unreachable. */
  readTwinCount: ((owner: Address) => Promise<number>) | null;
  /** Null when crypto payments are not configured. */
  verifyPayment: ((params: Omit<VerifyTransferParams, "token" | "recipient">) => Promise<VerifyTransferResult>) | null;
  usdc: { token: Address; recipient: Address } | null;
  explorerTxUrl(txHash: string): string | null;
}

export function createChainService(config: AppConfig, logger: Logger): ChainService {
  const base: ChainService = {
    chainId: config.CHAIN_ID,
    minter: null,
    readTwinCount: null,
    verifyPayment: null,
    usdc: null,
    explorerTxUrl: (hash) => explorerTxUrl(config.CHAIN_ID, hash),
  };

  let clients;
  try {
    clients = createChainClients({
      rpcUrl: config.RPC_URL,
      chainId: config.CHAIN_ID,
      minterPrivateKey: config.MINTER_PRIVATE_KEY,
      twinContractAddress: config.TWIN_CONTRACT_ADDRESS,
    });
  } catch (err) {
    logger.error("Web3 configuration invalid — running without on-chain features", {
      error: err instanceof Error ? err.message : String(err),
    });
    return base;
  }

  const { publicClient, walletClient, twinContractAddress } = clients;
  if (twinContractAddress) {
    base.readTwinCount = (owner) => readTwinCount(publicClient, twinContractAddress, owner);
    if (walletClient) base.minter = new TwinMinter(publicClient, walletClient, twinContractAddress);
  }

  const token = config.USDC_TOKEN_ADDRESS;
  const recipient = config.MERCHANT_WALLET_ADDRESS;
  if (token && recipient && isAddress(token) && isAddress(recipient)) {
    base.usdc = { token, recipient };
    base.verifyPayment = (params) =>
      verifyErc20Transfer(publicClient, {
        ...params,
        token,
        recipient,
        minConfirmations: params.minConfirmations ?? config.CRYPTO_MIN_CONFIRMATIONS,
      });
  }

  logger.info("Web3 configured", {
    chainId: config.CHAIN_ID,
    minting: Boolean(base.minter),
    loyaltyReads: Boolean(base.readTwinCount),
    cryptoPayments: Boolean(base.usdc),
  });
  return base;
}
