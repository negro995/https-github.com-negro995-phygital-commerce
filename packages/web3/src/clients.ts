import {
  createPublicClient,
  createWalletClient,
  http,
  isAddress,
  type Account,
  type Address,
  type Chain,
  type Hex,
  type PublicClient,
  type Transport,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { resolveChain } from "./chains";

export interface Web3Config {
  rpcUrl: string;
  chainId: number;
  minterPrivateKey?: string;
  twinContractAddress?: string;
}

export type MinterWalletClient = WalletClient<Transport, Chain, Account>;

export interface ChainClients {
  chain: Chain;
  publicClient: PublicClient;
  walletClient: MinterWalletClient | null;
  twinContractAddress: Address | null;
}

export function createChainClients(config: Web3Config): ChainClients {
  const chain = resolveChain(config.chainId, config.rpcUrl);
  const transport = http(config.rpcUrl, { timeout: 15_000, retryCount: 2 });
  const publicClient = createPublicClient({ chain, transport }) as PublicClient;

  let walletClient: MinterWalletClient | null = null;
  if (config.minterPrivateKey) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(config.minterPrivateKey)) {
      throw new Error("MINTER_PRIVATE_KEY must be a 0x-prefixed 32-byte hex string");
    }
    walletClient = createWalletClient({
      account: privateKeyToAccount(config.minterPrivateKey as Hex),
      chain,
      transport,
    });
  }

  let twinContractAddress: Address | null = null;
  if (config.twinContractAddress) {
    if (!isAddress(config.twinContractAddress)) throw new Error("TWIN_CONTRACT_ADDRESS is not a valid address");
    twinContractAddress = config.twinContractAddress;
  }

  return { chain, publicClient, walletClient, twinContractAddress };
}
