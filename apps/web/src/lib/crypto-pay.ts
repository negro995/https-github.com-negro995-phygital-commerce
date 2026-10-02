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
  if (!provider) throw new Error("No encontramos una wallet en el navegador. Instalá una o pegá el hash de la transacción.");
  const client = createWalletClient({ transport: custom(provider) });
  const [account] = await client.requestAddresses();
  if (!account) throw new Error("No seleccionaste ninguna cuenta de la wallet");

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
  if (e?.code === 4001 || /reject|denied/i.test(e?.message ?? "")) return "Cancelaste la transacción en tu wallet.";
  if (e?.code === 4902) return "Tu wallet todavía no tiene esta red. Agregala y volvé a intentar.";
  return e?.shortMessage ?? e?.message ?? "Error de la wallet";
}
