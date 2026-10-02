import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentProvider, PaymentSession, PaymentSessionInput } from "./types";

const API = "https://api.mercadopago.com";

export interface MercadoPagoPayment {
  id: number | string;
  status: "pending" | "approved" | "authorized" | "in_process" | "in_mediation" | "rejected" | "cancelled" | "refunded" | "charged_back";
  external_reference: string | null;
  transaction_amount: number;
  currency_id: string;
}

export class MercadoPagoPaymentProvider implements PaymentProvider {
  readonly method = "mercadopago" as const;

  constructor(
    private readonly accessToken: string,
    private readonly opts: { currency: string; fxRate: number; notificationUrl: string },
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async createSession(input: PaymentSessionInput): Promise<PaymentSession> {
    const unitPrice = Math.round(((input.totalCents / 100) * this.opts.fxRate + Number.EPSILON) * 100) / 100;
    const res = await this.fetchImpl(`${API}/checkout/preferences`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.accessToken}`,
        "content-type": "application/json",
        "x-idempotency-key": `pref-${input.orderId}`,
      },
      body: JSON.stringify({
        external_reference: input.orderId,
        items: [
          {
            id: input.orderId,
            title: `Order ${input.orderId.slice(-8).toUpperCase()}`,
            description: input.lines.map((l) => `${l.quantity}x ${l.name}`).join(", ").slice(0, 250),
            quantity: 1,
            currency_id: this.opts.currency,
            unit_price: unitPrice,
          },
        ],
        payer: { email: input.customerEmail },
        back_urls: { success: input.successUrl, failure: input.cancelUrl, pending: input.successUrl },
        auto_return: "approved",
        notification_url: this.opts.notificationUrl,
        metadata: { order_id: input.orderId },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Mercado Pago preference failed (${res.status}): ${await res.text()}`);
    const pref = (await res.json()) as { id: string; init_point: string; sandbox_init_point?: string };
    const url = this.accessToken.startsWith("TEST-") && pref.sandbox_init_point ? pref.sandbox_init_point : pref.init_point;
    return { ref: `mp_pref_${pref.id}`, client: { type: "redirect", url } };
  }

  async getPayment(paymentId: string): Promise<MercadoPagoPayment> {
    const res = await this.fetchImpl(`${API}/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { authorization: `Bearer ${this.accessToken}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Mercado Pago payment lookup failed (${res.status})`);
    return (await res.json()) as MercadoPagoPayment;
  }
}

/**
 * Validates the `x-signature` header of a Mercado Pago webhook.
 * Manifest: `id:{data.id};request-id:{x-request-id};ts:{ts};` signed with HMAC-SHA256.
 */
export function verifyMercadoPagoSignature(params: {
  secret: string;
  signatureHeader: string | null | undefined;
  requestId: string | null | undefined;
  dataId: string;
  maxAgeMs?: number;
  now?: number;
}): boolean {
  if (!params.signatureHeader) return false;
  const parts = Object.fromEntries(
    params.signatureHeader.split(",").map((p) => {
      const [k, ...v] = p.trim().split("=");
      return [k, v.join("=")];
    }),
  ) as Record<string, string | undefined>;
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  if (params.maxAgeMs !== undefined) {
    const tsMs = Number(ts) < 1e12 ? Number(ts) * 1000 : Number(ts);
    if (!Number.isFinite(tsMs) || Math.abs((params.now ?? Date.now()) - tsMs) > params.maxAgeMs) return false;
  }

  const id = /^[a-z0-9]+$/i.test(params.dataId) ? params.dataId.toLowerCase() : params.dataId;
  let manifest = `id:${id};`;
  if (params.requestId) manifest += `request-id:${params.requestId};`;
  manifest += `ts:${ts};`;
  const expected = createHmac("sha256", params.secret).update(manifest).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(v1, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
