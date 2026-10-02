import { LOYALTY_TIERS, PRODUCT_TYPES, conciergeRequestSchema } from "@phygital/shared";
import { Hono } from "hono";
import { z } from "zod";
import type { AppDeps } from "../deps";
import { notFound } from "../lib/errors";
import { parseJson, type AppEnv } from "../lib/hono";
import { runConcierge } from "../services/ai/concierge";

const listQuery = z.object({
  type: z.enum(PRODUCT_TYPES).optional(),
  category: z.string().max(60).optional(),
  q: z.string().max(100).optional(),
});

export function publicRoutes(deps: AppDeps) {
  const app = new Hono<AppEnv>();

  app.get("/config", (c) =>
    c.json({
      authMode: deps.auth.mode,
      paymentMethods: deps.payments.enabledMethods(),
      chainId: deps.chain.chainId,
      web3: {
        minting: Boolean(deps.chain.minter),
        loyaltyReads: Boolean(deps.chain.readTwinCount),
        usdc: deps.chain.usdc,
      },
      ai: deps.ai ? { provider: deps.ai.provider, model: deps.ai.model } : { provider: "fallback" },
      tiers: LOYALTY_TIERS,
    }),
  );

  app.get("/products", async (c) => {
    const { type, category, q } = listQuery.parse(c.req.query());
    const products = await deps.db.product.findMany({
      where: {
        active: true,
        ...(type ? { type } : {}),
        ...(category ? { category } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" as const } },
                { description: { contains: q, mode: "insensitive" as const } },
                { category: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "asc" },
    });
    return c.json({ products });
  });

  app.get("/products/:slug", async (c) => {
    const slug = c.req.param("slug");
    const product = await deps.db.product.findFirst({ where: { active: true, OR: [{ slug }, { id: slug }] } });
    if (!product) throw notFound("el producto");
    return c.json({ product });
  });

  app.get("/loyalty/tiers", (c) => c.json({ tiers: LOYALTY_TIERS }));

  /** ERC-1155 metadata endpoint referenced by the contract URI (`{id}` = 64-char hex token id). */
  app.get("/twins/:file", async (c) => {
    const raw = c.req.param("file").replace(/\.json$/, "");
    const tokenId = /^[0-9a-f]{64}$/i.test(raw) ? Number.parseInt(raw, 16) : Number(raw);
    if (!Number.isSafeInteger(tokenId)) throw notFound("el gemelo");
    const product = await deps.db.product.findUnique({ where: { tokenId } });
    if (!product) throw notFound("el gemelo");
    return c.json({
      name: `${product.name} — Digital Twin`,
      description: `Soulbound Digital Twin proving ownership of "${product.name}". ${product.description}`,
      image: product.imageUrl,
      external_url: `${deps.config.WEB_URL}/products/${product.slug}`,
      attributes: [
        { trait_type: "Type", value: product.type },
        { trait_type: "Category", value: product.category },
        { trait_type: "Soulbound", value: "Yes" },
      ],
    });
  });

  app.post("/ai/concierge", async (c) => {
    const body = await parseJson(c, conciergeRequestSchema);
    return c.json(await runConcierge(deps, body, c.get("user")));
  });

  return app;
}
