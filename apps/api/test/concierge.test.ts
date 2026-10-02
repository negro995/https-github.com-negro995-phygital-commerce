import { describe, expect, it, vi } from "vitest";
import { fallbackRecommendations, parseModelOutput, runConcierge, type CustomerContext } from "../src/services/ai/concierge";
import type { ConciergeModel } from "../src/services/ai/models";
import { fakeDb, makeDeps, product } from "./helpers";

const emptyCtx = (): CustomerContext => ({
  loyalty: null,
  purchasedProductIds: new Set(),
  categoryAffinity: new Map(),
  webOrders: 0,
  inStorePurchases: 0,
  qrCheckIns: 0,
  recentItems: [],
});

const catalog = [
  product({ id: "coffee", slug: "coffee", name: "Artisan Coffee Beans", category: "food", priceCents: 2800 }),
  product({ id: "jacket", slug: "jacket", name: "Leather Jacket", category: "apparel", priceCents: 24900 }),
  product({ id: "mug", slug: "mug", name: "Ceramic Mug Set", category: "home", priceCents: 3900 }),
  product({ id: "soldout", slug: "soldout", name: "Coffee Grinder", category: "food", stock: 0 }),
];

describe("parseModelOutput", () => {
  it("extracts JSON wrapped in prose or code fences", () => {
    const raw = 'Sure!\n```json\n{"reply":"Hi","recommendations":[{"productId":"coffee","reason":"x"}]}\n```';
    expect(parseModelOutput(raw)).toEqual({ reply: "Hi", recommendations: [{ productId: "coffee", reason: "x" }] });
  });

  it("throws on malformed output", () => {
    expect(() => parseModelOutput("no json here")).toThrow();
    expect(() => parseModelOutput('{"reply": 1}')).toThrow();
  });
});

describe("fallbackRecommendations", () => {
  it("ranks keyword matches first and never recommends out-of-stock items", () => {
    const picks = fallbackRecommendations("I love coffee", catalog, emptyCtx());
    expect(picks[0]!.productId).toBe("coffee");
    expect(picks.map((p) => p.productId)).not.toContain("soldout");
  });

  it("uses category affinity and deprioritises already-owned products", () => {
    const ctx = emptyCtx();
    ctx.categoryAffinity.set("apparel", 4);
    ctx.purchasedProductIds.add("coffee");
    const picks = fallbackRecommendations("surprise me", catalog, ctx);
    expect(picks[0]!.productId).toBe("jacket");
    expect(picks[0]!.reason).toMatch(/apparel/);
  });
});

describe("runConcierge", () => {
  const deps = (ai: ConciergeModel | null) =>
    makeDeps({ ai, db: fakeDb({ product: { findMany: vi.fn(async () => catalog) } }) });

  it("uses the LLM and drops hallucinated product ids", async () => {
    const ai: ConciergeModel = {
      provider: "openai",
      model: "test",
      complete: vi.fn(async () =>
        JSON.stringify({ reply: "Try these", recommendations: [{ productId: "mug", reason: "cozy" }, { productId: "fake", reason: "?" }] }),
      ),
    };
    const res = await runConcierge(deps(ai), { message: "gift ideas", history: [] }, null);
    expect(res).toMatchObject({ source: "openai", degraded: false, reply: "Try these" });
    expect(res.recommendations.map((r) => r.productId)).toEqual(["mug"]);
  });

  it("falls back to the rule-based recommender when the LLM fails", async () => {
    const ai: ConciergeModel = { provider: "anthropic", model: "test", complete: vi.fn(async () => Promise.reject(new Error("429"))) };
    const res = await runConcierge(deps(ai), { message: "coffee", history: [] }, null);
    expect(res).toMatchObject({ source: "fallback", degraded: true });
    expect(res.recommendations[0]!.productId).toBe("coffee");
  });

  it("works without any AI provider configured", async () => {
    const res = await runConcierge(deps(null), { message: "coffee", history: [] }, null);
    expect(res).toMatchObject({ source: "fallback", degraded: false, loyalty: null });
    expect(res.recommendations[0]!.memberPriceCents).toBe(2800);
  });
});
