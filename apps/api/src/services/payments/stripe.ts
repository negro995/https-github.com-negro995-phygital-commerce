import Stripe from "stripe";
import type { PaymentProvider, PaymentSession, PaymentSessionInput } from "./types";

export type StripeCheckoutClient = Pick<Stripe, "checkout" | "webhooks">;

export class StripePaymentProvider implements PaymentProvider {
  readonly method = "stripe" as const;
  constructor(readonly stripe: StripeCheckoutClient) {}

  static fromSecretKey(secretKey: string): StripePaymentProvider {
    return new StripePaymentProvider(new Stripe(secretKey, { maxNetworkRetries: 2, timeout: 15_000 }));
  }

  async createSession(input: PaymentSessionInput): Promise<PaymentSession> {
    const itemCount = input.lines.reduce((n, l) => n + l.quantity, 0);
    const summary = input.lines.map((l) => `${l.quantity}× ${l.name}`).join(", ");
    const session = await this.stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: input.customerEmail,
        client_reference_id: input.orderId,
        metadata: { orderId: input.orderId },
        payment_intent_data: { metadata: { orderId: input.orderId } },
        // A single line carries the exact, loyalty-discounted total computed by the backend.
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: input.currency.toLowerCase(),
              unit_amount: input.totalCents,
              product_data: {
                name: `Order ${input.orderId.slice(-8).toUpperCase()} (${itemCount} item${itemCount === 1 ? "" : "s"})`,
                description: summary.slice(0, 500),
              },
            },
          },
        ],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
      },
      { idempotencyKey: `checkout-${input.orderId}` },
    );
    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return { ref: session.id, client: { type: "redirect", url: session.url } };
  }
}
