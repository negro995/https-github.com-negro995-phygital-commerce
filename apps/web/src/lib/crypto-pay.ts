import { createWalletClient, custom, encodeFunctionData, erc20Abi, numberToHex, type Address, type EIP1193Provider, type Hash } from "viem";

const injectedProvider = (): EIP1193Provider | undefined =>
  typeof window === "undefined" ? undefined : ((window as { ethereum?: EIP1193Provider }).ethereum ?? undefined);

export interface CryptoPaymentRequest {
  chainId: number;
  token: string;
  recipient: string;
  amount: string;
}

export const hasInjectedWallet = () => Boolean(injectedProvider());

/** Sends the ERC-20 transfer from the user's browser wallet and returns the tx hash. */
export async function payWithInjectedWallet(req: CryptoPaymentRequest, provider: EIP1193Provider | undefined = injectedProvider()): Promise<Hash> {
  if (!provider) throw new Error("No browser wallet found. Install a wallet or paste a transaction hash instead.");
  const client = createWalletClient({ transport: custom(provider) });
  const [account] = await client.requestAddresses();
  if (!account) throw new Error("No wallet account selected");

  const currentChain = await client.getChainId();
  if (currentChain !== req.chainId) {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: numberToHex(req.chainId) }] });
  }
  return provider.request({
    method: "eth_sendTransaction",
    params: [
      {
        from: account,
        to: req.token as Address,
        data: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [req.recipient as Address, BigInt(req.amount)] }),
      },
    ],
  });
}

/** Maps common wallet errors to friendly copy. */
export function walletErrorMessage(err: unknown): string {
  const e = err as { code?: number; shortMessage?: string; message?: string };
  if (e?.code === 4001 || /reject|denied/i.test(e?.message ?? "")) return "You cancelled the transaction in your wallet.";
  if (e?.code === 4902) return "Your wallet doesn't know this network yet. Add it and try again.";
  return e?.shortMessage ?? e?.message ?? "Wallet error";
}
