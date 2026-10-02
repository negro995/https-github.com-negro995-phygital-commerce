import type { Product, User } from "@phygital/db";
import { conciergeResponseSchema, formatCents, type ConciergeRequest } from "@phygital/shared";
import type { AppDeps } from "../../deps";
import { errorMessage } from "../../lib/util";
import { getLoyaltyStatus, type LoyaltyStatus } from "../loyalty";

export interface CustomerContext {
  loyalty: LoyaltyStatus | null;
  purchasedProductIds: Set<string>;
  categoryAffinity: Map<string, number>;
  webOrders: number;
  inStorePurchases: number;
  qrCheckIns: number;
  recentItems: string[];
}

export interface ConciergeRecommendation {
  productId: string;
  slug: string;
  name: string;
  priceCents: number;
  /** Price after the customer's automatically applied loyalty discount. */
  memberPriceCents: number;
  imageUrl: string | null;
  type: Product["type"];
  reason: string;
}

export interface ConciergeResult {
  reply: string;
  recommendations: ConciergeRecommendation[];
  loyalty: { tier: string; tierName: string; discountBps: number; autoApplied: boolean; twinCount: number } | null;
  source: "openai" | "anthropic" | "fallback";
  degraded: boolean;
}

export async function buildCustomerContext(
  deps: Pick<AppDeps, "db" | "chain" | "logger">,
  user: User | null,
): Promise<CustomerContext> {
  const empty: CustomerContext = {
    loyalty: null,
    purchasedProductIds: new Set(),
    categoryAffinity: new Map(),
    webOrders: 0,
    inStorePurchases: 0,
    qrCheckIns: 0,
    recentItems: [],
  };
  if (!user) return empty;

  const [orders, checkIns, claimed, loyalty] = await Promise.all([
    deps.db.order.findMany({
      where: { userId: user.id, status: { in: ["PAID", "FULFILLED"] } },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    deps.db.checkIn.count({ where: { userId: user.id } }),
    deps.db.productPassport.findMany({
      where: { claimedById: user.id },
      include: { product: true },
      orderBy: { claimedAt: "desc" },
      take: 25,
    }),
    getLoyaltyStatus(deps, user),
  ]);

  const ctx: CustomerContext = { ...empty, loyalty, qrCheckIns: checkIns };
  const touch = (p: Product) => {
    ctx.purchasedProductIds.add(p.id);
    ctx.categoryAffinity.set(p.category, (ctx.categoryAffinity.get(p.category) ?? 0) + 1);
    if (ctx.recentItems.length < 10 && !ctx.recentItems.includes(p.name)) ctx.recentItems.push(p.name);
  };
  for (const order of orders) {
    if (order.channel === "WEB") ctx.webOrders++;
    else ctx.inStorePurchases++;
    order.items.forEach((i) => touch(i.product));
  }
  claimed.forEach((p) => touch(p.product));
  return ctx;
}

export function buildSystemPrompt(catalog: Product[], ctx: CustomerContext): string {
  const tier = ctx.loyalty?.tier;
  const catalogLines = catalog
    .map(
      (p) =>
        `- id=${p.id} | ${p.name} | ${p.type.toLowerCase()} | category=${p.category} | ${formatCents(p.priceCents)} | stock=${p.stock}`,
    )
    .join("\n");
  const affinity = [...ctx.categoryAffinity.entries()].map(([c, n]) => `${c}(${n})`).join(", ") || "none yet";
  return [
    "You are the AI shopping concierge of a retail brand that sells physical and digital products.",
    "Every purchase or in-store QR scan mints a soulbound Digital Twin NFT that raises the customer's loyalty tier.",
    "Be warm, concise (max 90 words) and concrete. Only recommend products from the catalog below, in stock, using their exact id.",
    "Never invent discounts: the loyalty discount is applied automatically at checkout by the system.",
    "",
    "CUSTOMER PROFILE",
    tier
      ? `- Loyalty tier: ${tier.name} (${ctx.loyalty!.twinCount} Digital Twins, ${tier.discountBps / 100}% auto-discount)`
      : "- Guest (not signed in). Encourage signing in to earn Digital Twins and discounts.",
    ctx.loyalty?.next
      ? `- ${ctx.loyalty.next.twinsNeeded} more twin(s) unlock ${ctx.loyalty.next.tier.name} (${ctx.loyalty.next.tier.discountBps / 100}% off)`
      : "",
    `- Web orders: ${ctx.webOrders}, in-store purchases: ${ctx.inStorePurchases}, QR check-ins: ${ctx.qrCheckIns}`,
    `- Category affinity: ${affinity}`,
    `- Recently owned: ${ctx.recentItems.join(", ") || "nothing yet"}`,
    "",
    "CATALOG",
    catalogLines,
    "",
    'Respond ONLY with a JSON object: {"reply": string, "recommendations": [{"productId": string, "reason": string}]} with 1-3 recommendations.',
  ]
    .filter((l) => l !== "")
    .join("\n");
}

/** Extracts the first JSON object from a model completion (tolerates code fences / prose). */
export function parseModelOutput(raw: string) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object in model output");
  return conciergeResponseSchema.parse(JSON.parse(raw.slice(start, end + 1)));
}

const STOPWORDS = new Set(["the", "a", "an", "for", "and", "or", "to", "of", "me", "i", "my", "something", "want", "need", "looking", "show", "some"]);

/** Deterministic recommender used when no LLM is configured or the LLM fails. */
export function fallbackRecommendations(message: string, catalog: Product[], ctx: CustomerContext) {
  const terms = message
    .toLowerCase()
    .split(/[^a-z0-9áéíóúñ]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
  const scored = catalog
    .filter((p) => p.stock > 0)
    .map((p) => {
      const haystack = `${p.name} ${p.category} ${p.description} ${p.type}`.toLowerCase();
      const keyword = terms.reduce((s, t) => s + (haystack.includes(t) ? 3 : 0), 0);
      const affinity = ctx.categoryAffinity.get(p.category) ?? 0;
      const novelty = ctx.purchasedProductIds.has(p.id) ? -2 : 1;
      return { p, score: keyword + affinity + novelty, keyword, affinity };
    })
    .sort((a, b) => b.score - a.score || a.p.priceCents - b.p.priceCents)
    .slice(0, 3);

  return scored.map(({ p, keyword, affinity }) => ({
    productId: p.id,
    reason:
      keyword > 0
        ? `Matches what you asked for (${p.category}).`
        : affinity > 0
          ? `You love ${p.category} — this pairs well with what you own.`
          : `A customer favourite in ${p.category}.`,
  }));
}

function fallbackReply(ctx: CustomerContext, count: number): string {
  const tier = ctx.loyalty?.tier;
  const greeting = tier
    ? `As a ${tier.name}-tier member you get ${tier.discountBps / 100}% off automatically.`
    : "Sign in to earn a Digital Twin with every purchase and unlock member discounts.";
  return count > 0 ? `Here are ${count} picks I think you'll like. ${greeting}` : `I couldn't find a match right now. ${greeting}`;
}

export async function runConcierge(deps: AppDeps, request: ConciergeRequest, user: User | null): Promise<ConciergeResult> {
  const [catalog, ctx] = await Promise.all([
    deps.db.product.findMany({ where: { active: true }, orderBy: { createdAt: "desc" }, take: 60 }),
    buildCustomerContext(deps, user),
  ]);
  const byId = new Map(catalog.map((p) => [p.id, p]));
  const discountBps = ctx.loyalty?.tier.discountBps ?? 0;

  let reply: string;
  let picks: { productId: string; reason: string }[];
  let source: ConciergeResult["source"] = "fallback";
  let degraded = false;

  if (deps.ai) {
    try {
      const raw = await deps.ai.complete({
        system: buildSystemPrompt(catalog, ctx),
        messages: [...request.history, { role: "user", content: request.message }],
      });
      const parsed = parseModelOutput(raw);
      reply = parsed.reply;
      picks = parsed.recommendations.filter((r) => byId.has(r.productId));
      source = deps.ai.provider;
    } catch (err) {
      deps.logger.warn("AI concierge failed; using fallback recommender", { error: errorMessage(err) });
      picks = fallbackRecommendations(request.message, catalog, ctx);
      reply = fallbackReply(ctx, picks.length);
      degraded = true;
    }
  } else {
    picks = fallbackRecommendations(request.message, catalog, ctx);
    reply = fallbackReply(ctx, picks.length);
  }

  return {
    reply,
    recommendations: picks.slice(0, 3).map(({ productId, reason }) => {
      const p = byId.get(productId)!;
      return {
        productId: p.id,
        slug: p.slug,
        name: p.name,
        priceCents: p.priceCents,
        memberPriceCents: p.priceCents - Math.floor((p.priceCents * discountBps) / 10_000),
        imageUrl: p.imageUrl,
        type: p.type,
        reason,
      };
    }),
    loyalty: ctx.loyalty
      ? {
          tier: ctx.loyalty.tier.id,
          tierName: ctx.loyalty.tier.name,
          discountBps,
          autoApplied: discountBps > 0,
          twinCount: ctx.loyalty.twinCount,
        }
      : null,
    source,
    degraded,
  };
}
