import type { User } from "@phygital/db";
import QRCode from "qrcode";
import type { AppDeps } from "../deps";
import { AppError, notFound } from "../lib/errors";
import { randomCode } from "../lib/util";
import { decrementStock, mintJobsForOrder } from "./orders";
import { ensureWallet } from "./users";

export function passportUrl(webUrl: string, code: string) {
  return `${webUrl}/p/${code}`;
}

export async function passportQrSvg(webUrl: string, code: string): Promise<string> {
  return QRCode.toString(passportUrl(webUrl, code), { type: "svg", margin: 1, errorCorrectionLevel: "M" });
}

export async function generatePassports(
  deps: Pick<AppDeps, "db" | "config">,
  input: { productId: string; storeId?: string; quantity: number; orderId?: string; claimedById?: string },
) {
  const product = await deps.db.product.findUnique({ where: { id: input.productId } });
  if (!product) throw notFound("el producto");
  if (product.type !== "PHYSICAL") throw new AppError("BAD_REQUEST", "QR passports are only for physical products");

  const existing = await deps.db.productPassport.count({ where: { productId: product.id } });
  const prefix = product.slug.replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase();
  const now = new Date();
  const rows = Array.from({ length: input.quantity }, (_, i) => ({
    code: randomCode(12),
    serial: `${prefix}-${String(product.tokenId).padStart(3, "0")}-${String(existing + i + 1).padStart(5, "0")}`,
    productId: product.id,
    storeId: input.storeId,
    orderId: input.orderId,
    claimedById: input.claimedById,
    claimedAt: input.claimedById ? now : undefined,
  }));
  await deps.db.productPassport.createMany({ data: rows });
  return Promise.all(
    rows.map(async (r) => ({
      code: r.code,
      serial: r.serial,
      url: passportUrl(deps.config.WEB_URL, r.code),
      qrSvg: await passportQrSvg(deps.config.WEB_URL, r.code),
    })),
  );
}

/** Public authenticity view of a passport (no personal data). */
export async function getPassport(deps: Pick<AppDeps, "db" | "chain">, code: string, viewer: User | null) {
  const passport = await deps.db.productPassport.findUnique({
    where: { code },
    include: { product: true, store: true, mint: true },
  });
  if (!passport) throw notFound("el pasaporte");
  return {
    code: passport.code,
    serial: passport.serial,
    authentic: true,
    product: {
      id: passport.product.id,
      slug: passport.product.slug,
      name: passport.product.name,
      description: passport.product.description,
      imageUrl: passport.product.imageUrl,
      tokenId: passport.product.tokenId,
    },
    store: passport.store ? { name: passport.store.name, city: passport.store.city } : null,
    claimed: Boolean(passport.claimedById),
    claimedByViewer: Boolean(viewer && passport.claimedById === viewer.id),
    claimedAt: passport.claimedAt,
    mint: passport.mint
      ? {
          status: passport.mint.status,
          txHash: passport.mint.txHash,
          explorerUrl: passport.mint.txHash ? deps.chain.explorerTxUrl(passport.mint.txHash) : null,
        }
      : null,
  };
}

/** Customer scans the QR on a physical product: records a check-in and mints the Digital Twin. */
export async function claimPassport(deps: AppDeps, code: string, rawUser: User) {
  const user = await ensureWallet(deps.db, deps.wallets, rawUser);
  const result = await deps.db.$transaction(async (tx) => {
    const passport = await tx.productPassport.findUnique({ where: { code }, include: { product: true } });
    if (!passport) throw notFound("el pasaporte");
    if (passport.claimedById && passport.claimedById !== user.id) {
      throw new AppError("CONFLICT", "Este producto ya fue reclamado por otra persona");
    }
    await tx.checkIn.create({ data: { userId: user.id, storeId: passport.storeId, passportId: passport.id } });
    if (passport.claimedById === user.id) return { alreadyClaimed: true };

    const claimed = await tx.productPassport.updateMany({
      where: { id: passport.id, claimedById: null },
      data: { claimedById: user.id, claimedAt: new Date() },
    });
    if (claimed.count === 0) throw new AppError("CONFLICT", "Otra persona acaba de reclamar este producto");

    if (passport.product.twinEnabled) {
      await tx.nftMint.create({
        data: {
          mintRef: `passport:${passport.code}`,
          source: "PASSPORT_CLAIM",
          userId: user.id,
          productId: passport.productId,
          passportId: passport.id,
          walletAddress: user.walletAddress,
          tokenId: passport.product.tokenId,
        },
      });
    }
    return { alreadyClaimed: false };
  });
  if (!result.alreadyClaimed) deps.kickMintWorker();
  return { ...result, passport: await getPassport(deps, code, user) };
}

/** In-store (POS) sale recorded by staff. */
export async function recordPosSale(
  deps: AppDeps,
  input: { storeId: string; items: { productId: string; quantity: number }[]; customerEmail?: string; issuePassports: boolean },
) {
  const { db } = deps;
  const store = await db.store.findUnique({ where: { id: input.storeId } });
  if (!store) throw notFound("el local");
  const products = await db.product.findMany({ where: { id: { in: input.items.map((i) => i.productId) } } });
  const byId = new Map(products.map((p) => [p.id, p]));
  for (const item of input.items) if (!byId.has(item.productId)) throw notFound(`el producto ${item.productId}`);

  let customer: User | null = null;
  if (input.customerEmail) {
    const email = input.customerEmail.toLowerCase();
    customer = await db.user.upsert({ where: { email }, create: { email }, update: {} });
    customer = await ensureWallet(db, deps.wallets, customer);
  }

  const subtotal = input.items.reduce((s, i) => s + byId.get(i.productId)!.priceCents * i.quantity, 0);
  const order = await db.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        channel: "IN_STORE",
        storeId: store.id,
        userId: customer?.id,
        status: "PAID",
        paymentMethod: "pos",
        paidAt: new Date(),
        subtotalCents: subtotal,
        totalCents: subtotal,
        walletAddress: customer?.walletAddress,
        items: {
          create: input.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            unitPriceCents: byId.get(i.productId)!.priceCents,
          })),
        },
      },
      include: { items: { include: { product: { select: { twinEnabled: true, tokenId: true } } } } },
    });
    await decrementStock(tx, created.items, deps.logger);
    const jobs = mintJobsForOrder(created);
    if (jobs.length) await tx.nftMint.createMany({ data: jobs, skipDuplicates: true });
    return created;
  });

  const passports = [];
  if (input.issuePassports) {
    for (const item of input.items) {
      if (byId.get(item.productId)!.type !== "PHYSICAL") continue;
      passports.push(
        ...(await generatePassports(deps, {
          productId: item.productId,
          storeId: store.id,
          quantity: item.quantity,
          orderId: order.id,
          // Known customers get their twin via the order; the passport then only proves authenticity.
          claimedById: customer?.id,
        })),
      );
    }
  }
  if (customer) deps.kickMintWorker();
  return { orderId: order.id, totalCents: order.totalCents, customerWallet: customer?.walletAddress ?? null, passports };
}
