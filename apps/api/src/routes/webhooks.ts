import { Prisma } from "@phygital/db";
import { Hono } from "hono";
import type Stripe from "stripe";
import type { AppDeps } from "../deps";
import { AppError } from "../lib/errors";
import type { AppEnv } from "../lib/hono";
import { errorMessage } from "../lib/util";
import { markOrderPaid, markOrderStatus } from "../services/orders";
import { verifyMercadoPagoSignature } from "../services/payments/mercadopago";

/** Records a webhook event id; returns false if it was already processed. */
async function firstDelivery(deps: AppDeps, provider: string, id: string, type: string): Promise<boolean> {
  try {
    await deps.db.webhookEvent.create({ data: { id: `${provider}:${id}`, provider, type } });
    return true;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return false;
    throw err;
  }
}

export function webhookRoutes(deps: AppDeps) {
  const app = new Hono<AppEnv>();

  app.post("/stripe", async (c) => {
    const stripe = deps.payments.stripe;
    const secret = deps.config.STRIPE_WEBHOOK_SECRET;
    if (!stripe || !secret) throw new AppError("PAYMENT_PROVIDER_UNAVAILABLE", "Stripe is not configured");

    const signature = c.req.header("stripe-signature");
    const payload = await c.req.text();
    let event: Stripe.Event;
    try {
      event = await stripe.stripe.webhooks.constructEventAsync(payload, signature ?? "", secret);
    } catch (err) {
      deps.logger.warn("Stripe webhook signature verification failed", { error: errorMessage(err) });
      throw new AppError("BAD_REQUEST", "Invalid Stripe signature");
    }
    if (!(await firstDelivery(deps, "stripe", event.id, event.type))) return c.json({ received: true, duplicate: true });

    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object;
      const orderId = session.metadata?.orderId ?? session.client_reference_id;
      if (orderId && session.payment_status === "paid") await markOrderPaid(deps, orderId, session.id);
    } else if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object;
      const orderId = session.metadata?.orderId ?? session.client_reference_id;
      if (orderId) await markOrderStatus(deps.db, orderId, event.type === "checkout.session.expired" ? "CANCELLED" : "PAYMENT_FAILED");
    }
    return c.json({ received: true });
  });

  app.post("/mercadopago", async (c) => {
    const mp = deps.payments.mercadopago;
    if (!mp) throw new AppError("PAYMENT_PROVIDER_UNAVAILABLE", "Mercado Pago is not configured");

    const body = (await c.req.json().catch(() => ({}))) as { type?: string; action?: string; data?: { id?: string | number } };
    const type = body.type ?? c.req.query("type") ?? c.req.query("topic");
    const dataId = String(body.data?.id ?? c.req.query("data.id") ?? c.req.query("id") ?? "");
    if (type !== "payment" || !dataId) return c.json({ received: true, ignored: true });

    const secret = deps.config.MERCADOPAGO_WEBHOOK_SECRET;
    if (secret) {
      const valid = verifyMercadoPagoSignature({
        secret,
        signatureHeader: c.req.header("x-signature"),
        requestId: c.req.header("x-request-id"),
        dataId,
      });
      if (!valid) throw new AppError("BAD_REQUEST", "Invalid Mercado Pago signature");
    }

    // Never trust the notification body: fetch the payment from Mercado Pago.
    const payment = await mp.getPayment(dataId);
    if (!payment.external_reference) return c.json({ received: true, ignored: true });
    if (!(await firstDelivery(deps, "mercadopago", `${payment.id}:${payment.status}`, type))) {
      return c.json({ received: true, duplicate: true });
    }
    if (payment.status === "approved") await markOrderPaid(deps, payment.external_reference, `mp_pay_${payment.id}`);
    else if (payment.status === "rejected" || payment.status === "cancelled") {
      await markOrderStatus(deps.db, payment.external_reference, "PAYMENT_FAILED");
    }
    return c.json({ received: true });
  });

  return app;
}
