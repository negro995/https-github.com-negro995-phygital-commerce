import { checkoutRequestSchema, cryptoConfirmSchema } from "@phygital/shared";
import { Hono } from "hono";
import type { AppDeps } from "../deps";
import { AppError, notFound } from "../lib/errors";
import { parseJson, requireUser, type AppEnv } from "../lib/hono";
import { getLoyaltyStatus } from "../services/loyalty";
import { createCheckout, markOrderPaid } from "../services/orders";
import { claimPassport, getPassport } from "../services/passports";

export function commerceRoutes(deps: AppDeps) {
  const app = new Hono<AppEnv>();

  const loadOrderView = async (id: string) => {
    const order = await deps.db.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: { select: { id: true, name: true, slug: true, imageUrl: true, type: true } } } },
        mints: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!order) throw notFound("Order");
    return {
      id: order.id,
      status: order.status,
      channel: order.channel,
      paymentMethod: order.paymentMethod,
      subtotalCents: order.subtotalCents,
      discountBps: order.discountBps,
      discountCents: order.discountCents,
      totalCents: order.totalCents,
      currency: order.currency,
      loyaltyTier: order.loyaltyTier,
      walletAddress: order.walletAddress,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      items: order.items.map((i) => ({ id: i.id, quantity: i.quantity, unitPriceCents: i.unitPriceCents, product: i.product })),
      mints: order.mints.map((m) => ({
        id: m.id,
        productId: m.productId,
        status: m.status,
        txHash: m.txHash,
        explorerUrl: m.txHash ? deps.chain.explorerTxUrl(m.txHash) : null,
        attempts: m.attempts,
        lastError: m.lastError,
      })),
    };
  };

  app.post("/checkout", async (c) => {
    const body = await parseJson(c, checkoutRequestSchema);
    return c.json(await createCheckout(deps, body, c.get("user")), 201);
  });

  app.get("/orders/:id", async (c) => c.json({ order: await loadOrderView(c.req.param("id")) }));

  app.post("/orders/:id/mock-confirm", async (c) => {
    if (!deps.payments.enabledMethods().includes("mock")) throw new AppError("FORBIDDEN", "Mock payments are disabled");
    const order = await deps.db.order.findUnique({ where: { id: c.req.param("id") } });
    if (!order) throw notFound("Order");
    if (order.paymentMethod !== "mock") throw new AppError("BAD_REQUEST", "Order is not a mock-payment order");
    await markOrderPaid(deps, order.id, `mock_${order.id}`);
    return c.json({ order: await loadOrderView(order.id) });
  });

  app.post("/orders/:id/crypto-confirm", async (c) => {
    const { txHash } = await parseJson(c, cryptoConfirmSchema);
    if (!deps.chain.verifyPayment) throw new AppError("PAYMENT_PROVIDER_UNAVAILABLE", "Crypto payments are not enabled");
    const order = await deps.db.order.findUnique({ where: { id: c.req.param("id") } });
    if (!order) throw notFound("Order");
    if (order.paymentMethod !== "crypto") throw new AppError("BAD_REQUEST", "Order is not a crypto order");
    if (order.status === "PAID" || order.status === "FULFILLED") return c.json({ status: "paid", order: await loadOrderView(order.id) });

    const reused = await deps.db.order.findFirst({ where: { paymentRef: txHash.toLowerCase(), NOT: { id: order.id } } });
    if (reused) throw new AppError("CONFLICT", "This transaction was already used for another order");

    let result;
    try {
      result = await deps.chain.verifyPayment({ txHash: txHash as `0x${string}`, minAmount: BigInt(order.totalCents) * 10_000n });
    } catch {
      throw new AppError("WEB3_UNAVAILABLE", "Could not reach the blockchain to verify your payment. We'll keep checking — try again shortly.");
    }
    if (!result.ok) {
      if (result.reason === "pending" || result.reason === "insufficient_confirmations") {
        return c.json({ status: "pending", message: result.message }, 202);
      }
      throw new AppError("PAYMENT_FAILED", result.message, { reason: result.reason });
    }
    await markOrderPaid(deps, order.id, txHash.toLowerCase());
    return c.json({ status: "paid", order: await loadOrderView(order.id) });
  });

  app.get("/me", async (c) => {
    const user = requireUser(c);
    return c.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role, walletAddress: user.walletAddress, walletProvider: user.walletProvider },
      loyalty: await getLoyaltyStatus(deps, user),
    });
  });

  app.get("/me/orders", async (c) => {
    const user = requireUser(c);
    const orders = await deps.db.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { items: { include: { product: { select: { name: true, slug: true, imageUrl: true } } } } },
    });
    return c.json({ orders });
  });

  app.get("/me/twins", async (c) => {
    const user = requireUser(c);
    const mints = await deps.db.nftMint.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { product: { select: { name: true, slug: true, imageUrl: true, type: true, tokenId: true } } },
    });
    return c.json({
      twins: mints.map((m) => ({
        id: m.id,
        status: m.status,
        source: m.source,
        tokenId: m.tokenId,
        txHash: m.txHash,
        explorerUrl: m.txHash ? deps.chain.explorerTxUrl(m.txHash) : null,
        lastError: m.lastError,
        createdAt: m.createdAt,
        product: m.product,
      })),
    });
  });

  app.get("/passports/:code", async (c) => c.json({ passport: await getPassport(deps, c.req.param("code"), c.get("user")) }));

  app.post("/passports/:code/claim", async (c) => {
    const user = requireUser(c);
    return c.json(await claimPassport(deps, c.req.param("code"), user));
  });

  return app;
}
