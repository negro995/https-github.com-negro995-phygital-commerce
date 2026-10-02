import type { PaymentMethod } from "@phygital/shared";
import type { AppConfig } from "../../config";
import { AppError } from "../../lib/errors";
import type { ChainService } from "../chain";
import { CryptoPaymentProvider } from "./crypto";
import { MercadoPagoPaymentProvider } from "./mercadopago";
import { MockPaymentProvider } from "./mock";
import { StripePaymentProvider } from "./stripe";
import type { PaymentProvider } from "./types";

export * from "./types";
export { CryptoPaymentProvider, MercadoPagoPaymentProvider, MockPaymentProvider, StripePaymentProvider };

export class PaymentRegistry {
  constructor(
    private readonly providers: {
      stripe?: StripePaymentProvider;
      mercadopago?: MercadoPagoPaymentProvider;
      crypto?: CryptoPaymentProvider;
      mock?: MockPaymentProvider;
    },
  ) {}

  get stripe() {
    return this.providers.stripe;
  }
  get mercadopago() {
    return this.providers.mercadopago;
  }

  enabledMethods(): PaymentMethod[] {
    return (Object.keys(this.providers) as PaymentMethod[]).filter((m) => this.providers[m]);
  }

  get(method: PaymentMethod): PaymentProvider {
    const provider = this.providers[method];
    if (!provider) {
      throw new AppError("PAYMENT_PROVIDER_UNAVAILABLE", `Payment method "${method}" is not enabled on this store`);
    }
    return provider;
  }
}

export function createPaymentRegistry(config: AppConfig, chain: ChainService): PaymentRegistry {
  return new PaymentRegistry({
    stripe: config.STRIPE_SECRET_KEY ? StripePaymentProvider.fromSecretKey(config.STRIPE_SECRET_KEY) : undefined,
    mercadopago: config.MERCADOPAGO_ACCESS_TOKEN
      ? new MercadoPagoPaymentProvider(config.MERCADOPAGO_ACCESS_TOKEN, {
          currency: config.MERCADOPAGO_CURRENCY,
          fxRate: config.MERCADOPAGO_FX_RATE,
          notificationUrl: `${config.API_PUBLIC_URL}/api/webhooks/mercadopago`,
        })
      : undefined,
    crypto: chain.usdc
      ? new CryptoPaymentProvider({ chainId: chain.chainId, token: chain.usdc.token, recipient: chain.usdc.recipient })
      : undefined,
    mock: config.ENABLE_MOCK_PAYMENTS ? new MockPaymentProvider() : undefined,
  });
}
