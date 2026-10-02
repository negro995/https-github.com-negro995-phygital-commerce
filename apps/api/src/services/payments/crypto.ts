import { centsToUsdcUnits } from "@phygital/shared";
import type { PaymentProvider, PaymentSession, PaymentSessionInput } from "./types";

/** USDC (or any 6-decimal stablecoin) transfer to the merchant wallet, verified on-chain afterwards. */
export class CryptoPaymentProvider implements PaymentProvider {
  readonly method = "crypto" as const;
  constructor(private readonly opts: { chainId: number; token: string; recipient: string; symbol?: string }) {}

  async createSession(input: PaymentSessionInput): Promise<PaymentSession> {
    return {
      ref: null,
      client: {
        type: "crypto",
        chainId: this.opts.chainId,
        token: this.opts.token,
        recipient: this.opts.recipient,
        amount: centsToUsdcUnits(input.totalCents).toString(),
        decimals: 6,
        symbol: this.opts.symbol ?? "USDC",
      },
    };
  }
}
