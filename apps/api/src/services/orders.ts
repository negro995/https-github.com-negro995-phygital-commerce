import type { Order, OrderItem, Prisma, PrismaClient, User } from "@phygital/db";
import { computeOrderTotals, type CheckoutRequest } from "@phygital/shared";
import type { AppDeps } from "../deps";
import { AppError } from "../lib/errors";
import { errorMessage } from "../lib/util";
import { getLoyaltyStatus } from "./loyalty";
import type { ClientPayment } from "./payments";
import { ensureWallet } from "./users";

export interface CheckoutResult {
  orderId: string;
  subtotalCents: number;
  discountCents: number;
  discountBps: number;
  totalCents: number;
  loyaltyTier: string;
  walletAddress: string | null;
  payment: ClientPayment;
}

export async function createCheckout(
  deps: AppDeps,
  input: CheckoutRequest,
  authUser: User | null,
): Promise<CheckoutResult> {
  const { db } = deps;
  const quantities = new Map<string, number>();
  for (const item of input.items) quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);

  const products = await db.product.findMany({ where: { id: { in: [...quantities.keys()] }, active: true } });
  if (products.length !== quantities.size) throw new AppError("BAD_REQUEST", "Uno o más productos no están disponibles");
  for (const p of products) {
    if (p.stock < quantities.get(p.id)!) {
      throw new AppError("OUT_OF_STOCK", `Quedan solo ${p.stock} de "${p.name}"`, { productId: p.id, stock: p.stock });
    }
  }

  // Fail fast before creating any record if the payment method is disabled.
  const provider = deps.payments.get(input.paymentMethod);

  const email = (authUser?.email ?? input.email).toLowerCase();
  let user =
    authUser ??
    (await db.user.upsert({ where: { email }, create: { email, name: input.name }, update: {} }));
  user = await ensureWallet(db, deps.wallets, user, input.walletAddress);

  const loyalty = await getLoyaltyStatus(deps, user);
  const lines = products.map((p) => ({ productId: p.id, unitPriceCents: p.priceCents, quantity: quantities.get(p.id)! }));
  const totals = computeOrderTotals(lines, loyalty.tier.discountBps);

  const order = await db.order.create({
    data: {
      userId: user.id,
      channel: "WEB",
      status: "PENDING_PAYMENT",
      paymentMethod: input.paymentMethod,
      subtotalCents: totals.subtotalCents,
      discountBps: totals.discountBps,
      discountCents: totals.discountCents,
      totalCents: totals.totalCents,
      loyaltyTier: loyalty.tier.id,
      walletAddress: user.walletAddress,
      items: { create: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitPriceCents: l.unitPriceCents })) },
    },
  });

  let session;
  try {
    session = await provider.createSession({
      orderId: order.id,
      totalCents: totals.totalCents,
      discountCents: totals.discountCents,
      currency: order.currency,
      customerEmail: email,
      lines: products.map((p) => ({ name: p.name, quantity: quantities.get(p.id)!, unitPriceCents: p.priceCents })),
      successUrl: `${deps.config.WEB_URL}/orders/${order.id}?status=success`,
      cancelUrl: `${deps.config.WEB_URL}/orders/${order.id}?status=cancelled`,
    });
  } catch (err) {
    deps.logger.error("Payment session creation failed", { orderId: order.id, method: input.paymentMethod, error: errorMessage(err) });
    await db.order.update({ where: { id: order.id }, data: { status: "PAYMENT_FAILED" } });
    throw new AppError("PAYMENT_PROVIDER_UNAVAILABLE", "El medio de pago no está disponible. Probá con otro.");
  }
  if (session.ref) await db.order.update({ where: { id: order.id }, data: { paymentRef: session.ref } });

  return {
    orderId: order.id,
    ...totals,
    loyaltyTier: loyalty.tier.id,
    walletAddress: user.walletAddress,
    payment: session.client,
  };
}

type OrderWithItems = Order & { items: (OrderItem & { product: { twinEnabled: boolean; tokenId: number } })[] };

/** Builds one mint job per purchased unit of every twin-enabled product. */
export function mintJobsForOrder(order: OrderWithItems): Prisma.NftMintCreateManyInput[] {
  if (!order.userId) return [];
  const jobs: Prisma.NftMintCreateManyInput[] = [];
  for (const item of order.items) {
    if (!item.product.twinEnabled) continue;
    for (let unit = 0; unit < item.quantity; unit++) {
      jobs.push({
        mintRef: `order:${order.id}:item:${item.id}:${unit}`,
        source: "ORDER",
        status: "PENDING",
        userId: order.userId,
        productId: item.productId,
        orderId: order.id,
        walletAddress: order.walletAddress,
        tokenId: item.product.tokenId,
      });
    }
  }
  return jobs;
}

/**
 * Transitions an order to PAID exactly once, decrements stock and queues Digital Twin mints.
 * Returns false if the order was already processed (idempotent for webhooks/retries).
 */
export async function markOrderPaid(
  deps: Pick<AppDeps, "db" | "logger" | "kickMintWorker">,
  orderId: string,
  paymentRef?: string,
): Promise<boolean> {
  const transitioned = await deps.db.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({
      where: { id: orderId, status: { in: ["PENDING_PAYMENT", "PAYMENT_FAILED"] } },
      data: { status: "PAID", paidAt: new Date(), ...(paymentRef ? { paymentRef } : {}) },
    });
    if (updated.count === 0) return false;

    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: { include: { product: { select: { twinEnabled: true, tokenId: true } } } } },
    });
    await decrementStock(tx, order.items, deps.logger);
    const jobs = mintJobsForOrder(order);
    if (jobs.length) await tx.nftMint.createMany({ data: jobs, skipDuplicates: true });
    return true;
  });
  if (transitioned) deps.kickMintWorker();
  return transitioned;
}

export async function decrementStock(
  tx: Prisma.TransactionClient | PrismaClient,
  items: Array<Pick<OrderItem, "productId" | "quantity">>,
  logger: AppDeps["logger"],
) {
  for (const item of items) {
    const res = await tx.product.updateMany({
      where: { id: item.productId, stock: { gte: item.quantity } },
      data: { stock: { decrement: item.quantity } },
    });
    if (res.count === 0) {
      logger.warn("Stock went negative-risk; clamping to zero (oversold)", { productId: item.productId });
      await tx.product.update({ where: { id: item.productId }, data: { stock: 0 } });
    }
  }
}

export async function markOrderStatus(db: PrismaClient, orderId: string, status: "CANCELLED" | "PAYMENT_FAILED") {
  await db.order.updateMany({ where: { id: orderId, status: "PENDING_PAYMENT" }, data: { status } });
}
