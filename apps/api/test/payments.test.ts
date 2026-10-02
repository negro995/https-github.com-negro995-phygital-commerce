import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { MockPaymentProvider, PaymentRegistry, StripePaymentProvider } from "../src/services/payments";
import type { StripeCheckoutClient } from "../src/services/payments/stripe";
import { MercadoPagoPaymentProvider, verifyMercadoPagoSignature } from "../src/services/payments/mercadopago";

const sessionInput = {
  orderId: "order_123456789",
  totalCents: 4750,
  discountCents: 250,
  currency: "USD",
  customerEmail: "ana@test.dev",
  lines: [{ name: "Mug", quantity: 1, unitPriceCents: 5000 }],
  successUrl: "http://web/ok",
  cancelUrl: "http://web/cancel",
};

describe("StripePaymentProvider", () => {
  it("charges the exact discounted total with an idempotency key", async () => {
    const create = vi.fn(async () => ({ id: "cs_1", url: "https://checkout.stripe.test/cs_1" }));
    const provider = new StripePaymentProvider({ checkout: { sessions: { create } } } as unknown as StripeCheckoutClient);
    const session = await provider.createSession(sessionInput);
    expect(session).toEqual({ ref: "cs_1", client: { type: "redirect", url: "https://checkout.stripe.test/cs_1" } });
    const [params, opts] = create.mock.calls[0] as unknown as [
      { line_items: { price_data: { unit_amount: number } }[]; metadata: Record<string, string> },
      { idempotencyKey: string },
    ];
    expect(params.line_items[0]!.price_data.unit_amount).toBe(4750);
    expect(params.metadata.orderId).toBe("order_123456789");
    expect(opts.idempotencyKey).toBe("checkout-order_123456789");
  });

  it("errors when Stripe returns no URL", async () => {
    const create = vi.fn(async () => ({ id: "cs_1", url: null }));
    const provider = new StripePaymentProvider({ checkout: { sessions: { create } } } as unknown as StripeCheckoutClient);
    await expect(provider.createSession(sessionInput)).rejects.toThrow(/URL/);
  });
});

describe("MercadoPagoPaymentProvider", () => {
  const preferenceBody = async (prefillPayer?: boolean) => {
    const fetchImpl = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) =>
        new Response(JSON.stringify({ id: "pref_1", init_point: "https://mp.test/pref_1" })),
    );
    const mp = new MercadoPagoPaymentProvider(
      "APP_USR-test",
      { currency: "ARS", fxRate: 1000, notificationUrl: "http://api/api/webhooks/mercadopago", prefillPayer },
      fetchImpl as unknown as typeof fetch,
    );
    const session = await mp.createSession(sessionInput);
    expect(session.client).toEqual({ type: "redirect", url: "https://mp.test/pref_1" });
    return JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)) as { payer?: { email: string }; items: Array<{ unit_price: number }> };
  };

  it("converts the total and prefills the payer email by default", async () => {
    const body = await preferenceBody();
    expect(body.items[0]?.unit_price).toBe(47500);
    expect(body.payer).toEqual({ email: "ana@test.dev" });
  });

  it("omits the payer when prefilling is disabled", async () => {
    expect((await preferenceBody(false)).payer).toBeUndefined();
  });
});

describe("verifyMercadoPagoSignature", () => {
  const secret = "mp_secret";
  const sign = (manifest: string) => createHmac("sha256", secret).update(manifest).digest("hex");

  it("accepts a valid signature", () => {
    const v1 = sign("id:123;request-id:req-1;ts:1700000000;");
    expect(verifyMercadoPagoSignature({ secret, signatureHeader: `ts=1700000000,v1=${v1}`, requestId: "req-1", dataId: "123" })).toBe(true);
  });

  it("rejects tampered ids, missing headers and stale timestamps", () => {
    const v1 = sign("id:123;request-id:req-1;ts:1700000000;");
    const header = `ts=1700000000,v1=${v1}`;
    expect(verifyMercadoPagoSignature({ secret, signatureHeader: header, requestId: "req-1", dataId: "999" })).toBe(false);
    expect(verifyMercadoPagoSignature({ secret, signatureHeader: null, requestId: "req-1", dataId: "123" })).toBe(false);
    expect(verifyMercadoPagoSignature({ secret, signatureHeader: "garbage", requestId: "req-1", dataId: "123" })).toBe(false);
    expect(
      verifyMercadoPagoSignature({ secret, signatureHeader: header, requestId: "req-1", dataId: "123", maxAgeMs: 60_000, now: Date.now() }),
    ).toBe(false);
  });
});

describe("PaymentRegistry", () => {
  it("lists enabled methods and rejects disabled ones", () => {
    const registry = new PaymentRegistry({ mock: new MockPaymentProvider() });
    expect(registry.enabledMethods()).toEqual(["mock"]);
    expect(() => registry.get("crypto")).toThrow(/not enabled/);
  });
});
