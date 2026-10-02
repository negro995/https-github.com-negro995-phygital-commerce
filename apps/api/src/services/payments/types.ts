import type { PaymentMethod } from "@phygital/shared";

export interface PaymentLine {
  name: string;
  quantity: number;
  unitPriceCents: number;
}

export interface PaymentSessionInput {
  orderId: string;
  totalCents: number;
  discountCents: number;
  currency: string;
  customerEmail: string;
  lines: PaymentLine[];
  successUrl: string;
  cancelUrl: string;
}

export type ClientPayment =
  | { type: "redirect"; url: string }
  | {
      type: "crypto";
      chainId: number;
      token: string;
      recipient: string;
      /** Amount in token base units (USDC: 6 decimals), as a decimal string. */
      amount: string;
      decimals: number;
      symbol: string;
    }
  | { type: "mock" };

export interface PaymentSession {
  /** Provider reference stored on the order (null when it only becomes known later, e.g. a tx hash). */
  ref: string | null;
  client: ClientPayment;
}

export interface PaymentProvider {
  method: PaymentMethod;
  createSession(input: PaymentSessionInput): Promise<PaymentSession>;
}
