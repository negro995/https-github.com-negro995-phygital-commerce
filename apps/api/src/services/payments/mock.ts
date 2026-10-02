import type { PaymentProvider, PaymentSession } from "./types";

/** Instant demo payments for local development and automated tests. */
export class MockPaymentProvider implements PaymentProvider {
  readonly method = "mock" as const;
  async createSession(): Promise<PaymentSession> {
    return { ref: null, client: { type: "mock" } };
  }
}
