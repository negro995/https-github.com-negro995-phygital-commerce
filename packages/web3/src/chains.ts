import { defineChain, type Chain } from "viem";
import { base, baseSepolia, hardhat, mainnet, polygon, polygonAmoy, sepolia } from "viem/chains";

const KNOWN_CHAINS: Record<number, Chain> = {
  [mainnet.id]: mainnet,
  [sepolia.id]: sepolia,
  [base.id]: base,
  [baseSepolia.id]: baseSepolia,
  [polygon.id]: polygon,
  [polygonAmoy.id]: polygonAmoy,
  [hardhat.id]: hardhat,
};

export function resolveChain(chainId: number, rpcUrl?: string): Chain {
  const known = KNOWN_CHAINS[chainId];
  if (known) return known;
  if (!rpcUrl) throw new Error(`Unknown chain id ${chainId}; provide an RPC URL to define it.`);
  return defineChain({
    id: chainId,
    name: `Chain ${chainId}`,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
}

export function explorerTxUrl(chainId: number, txHash: string): string | null {
  const explorer = KNOWN_CHAINS[chainId]?.blockExplorers?.default.url;
  return explorer ? `${explorer}/tx/${txHash}` : null;
}
