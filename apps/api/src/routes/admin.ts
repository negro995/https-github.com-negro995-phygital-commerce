import { MINT_STATUSES, passportGenerateSchema, posSaleSchema, productInputSchema } from "@phygital/shared";
import { Hono } from "hono";
import { z } from "zod";
import type { AppDeps } from "../deps";
import { notFound } from "../lib/errors";
import { parseJson, requireAdmin, type AppEnv } from "../lib/hono";
import { retryMint } from "../services/mints";
import { generatePassports, passportQrSvg, passportUrl, recordPosSale } from "../services/passports";

const storeInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().max(200).optional(),
  city: z.string().trim().max(100).optional(),
});

export function adminRoutes(deps: AppDeps) {
  const app = new Hono<AppEnv>();
  const { db } = deps;

  app.use("*", async (c, next) => {
    requireAdmin(c);
    await next();
  });

  app.get("/stats", async (c) => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60_000);
    const paid = { status: { in: ["PAID", "FULFILLED"] as ("PAID" | "FULFILLED")[] }, createdAt: { gte: since } };
    const [web, store, mintGroups, customers, lowStock, recentOrders, passports, claimed] = await Promise.all([
      db.order.aggregate({ where: { ...paid, channel: "WEB" }, _sum: { totalCents: true }, _count: true }),
      db.order.aggregate({ where: { ...paid, channel: "IN_STORE" }, _sum: { totalCents: true }, _count: true }),
      db.nftMint.groupBy({ by: ["status"], _count: true }),
      db.user.count({ where: { role: "CUSTOMER" } }),
      db.product.findMany({ where: { active: true, type: "PHYSICAL", stock: { lte: 10 } }, orderBy: { stock: "asc" }, take: 5 }),
      db.order.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { user: { select: { email: true } } } }),
      db.productPassport.count(),
      db.productPassport.count({ where: { claimedById: { not: null } } }),
    ]);
    return c.json({
      windowDays: 30,
      sales: {
        web: { revenueCents: web._sum.totalCents ?? 0, orders: web._count },
        inStore: { revenueCents: store._sum.totalCents ?? 0, orders: store._count },
      },
      mints: Object.fromEntries(MINT_STATUSES.map((s) => [s, mintGroups.find((g) => g.status === s)?._count ?? 0])),
      customers,
      passports: { issued: passports, claimed },
      lowStock,
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        channel: o.channel,
        status: o.status,
        totalCents: o.totalCents,
        paymentMethod: o.paymentMethod,
        email: o.user?.email ?? null,
        createdAt: o.createdAt,
      })),
    });
  });

  app.get("/products", async (c) => c.json({ products: await db.product.findMany({ orderBy: { createdAt: "asc" } }) }));

  app.post("/products", async (c) => {
    const input = await parseJson(c, productInputSchema);
    const product = await db.product.create({ data: { ...input, imageUrl: input.imageUrl || null } });
    return c.json({ product }, 201);
  });

  app.patch("/products/:id", async (c) => {
    const input = await parseJson(c, productInputSchema.partial());
    const exists = await db.product.findUnique({ where: { id: c.req.param("id") } });
    if (!exists) throw notFound("Product");
    const product = await db.product.update({
      where: { id: exists.id },
      data: { ...input, ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl || null } : {}) },
    });
    return c.json({ product });
  });

  app.get("/stores", async (c) => c.json({ stores: await db.store.findMany({ orderBy: { createdAt: "asc" } }) }));

  app.post("/stores", async (c) => {
    const input = await parseJson(c, storeInputSchema);
    return c.json({ store: await db.store.create({ data: input }) }, 201);
  });

  app.get("/orders", async (c) => {
    const orders = await db.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: { select: { email: true } }, store: { select: { name: true } }, _count: { select: { items: true } } },
    });
    return c.json({ orders });
  });

  app.post("/passports", async (c) => {
    const input = await parseJson(c, passportGenerateSchema);
    return c.json({ passports: await generatePassports(deps, input) }, 201);
  });

  app.get("/passports", async (c) => {
    const productId = c.req.query("productId");
    const passports = await db.productPassport.findMany({
      where: productId ? { productId } : {},
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        product: { select: { name: true } },
        claimedBy: { select: { email: true } },
        mint: { select: { status: true } },
      },
    });
    return c.json({
      passports: passports.map((p) => ({ ...p, url: passportUrl(deps.config.WEB_URL, p.code) })),
    });
  });

  app.get("/passports/:code/qr.svg", async (c) => {
    const passport = await db.productPassport.findUnique({ where: { code: c.req.param("code") } });
    if (!passport) throw notFound("Passport");
    c.header("content-type", "image/svg+xml");
    return c.body(await passportQrSvg(deps.config.WEB_URL, passport.code));
  });

  app.post("/pos-sales", async (c) => {
    const input = await parseJson(c, posSaleSchema);
    return c.json(await recordPosSale(deps, input), 201);
  });

  app.get("/mints", async (c) => {
    const status = z.enum(MINT_STATUSES).optional().parse(c.req.query("status") || undefined);
    const mints = await db.nftMint.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { product: { select: { name: true } }, user: { select: { email: true } } },
    });
    return c.json({ mints: mints.map((m) => ({ ...m, explorerUrl: m.txHash ? deps.chain.explorerTxUrl(m.txHash) : null })) });
  });

  app.post("/mints/:id/retry", async (c) => {
    const exists = await db.nftMint.findUnique({ where: { id: c.req.param("id") } });
    if (!exists) throw notFound("Mint");
    return c.json({ mint: await retryMint(deps, exists.id) });
  });

  return app;
}
