import { describe, expect, it, vi } from "vitest";
import { createCheckout, markOrderPaid, mintJobsForOrder } from "../src/services/orders";
import { AppError } from "../src/lib/errors";
import { fakeDb, makeDeps, product } from "./helpers";

const baseOrder = {
  id: "o1",
  userId: "u1",
  walletAddress: "0xabc",
} as const;

describe("mintJobsForOrder", () => {
  it("creates one job per unit of each twin-enabled product with deterministic refs", () => {
    const order = {
      ...baseOrder,
      items: [
        { id: "i1", productId: "p1", quantity: 2, product: { twinEnabled: true, tokenId: 7 } },
        { id: "i2", productId: "p2", quantity: 1, product: { twinEnabled: false, tokenId: 8 } },
      ],
    };
    const jobs = mintJobsForOrder(order as unknown as Parameters<typeof mintJobsForOrder>[0]);
    expect(jobs.map((j) => j.mintRef)).toEqual(["order:o1:item:i1:0", "order:o1:item:i1:1"]);
    expect(jobs.every((j) => j.tokenId === 7 && j.walletAddress === "0xabc" && j.source === "ORDER")).toBe(true);
  });

  it("skips guest orders without a user", () => {
    const order = { ...baseOrder, userId: null, items: [{ id: "i1", productId: "p1", quantity: 1, product: { twinEnabled: true, tokenId: 1 } }] };
    expect(mintJobsForOrder(order as unknown as Parameters<typeof mintJobsForOrder>[0])).toEqual([]);
  });
});

describe("markOrderPaid", () => {
  it("is idempotent: a second webhook delivery does nothing", async () => {
    const tx = {
      order: { updateMany: vi.fn(async () => ({ count: 0 })) },
    };
    const deps = makeDeps({ db: fakeDb({ $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) }) });
    expect(await markOrderPaid(deps, "o1", "ref")).toBe(false);
    expect(deps.kickMintWorker).not.toHaveBeenCalled();
  });

  it("queues mint jobs and kicks the worker on first payment", async () => {
    const createMany = vi.fn(async () => ({ count: 1 }));
    const tx = {
      order: {
        updateMany: vi.fn(async () => ({ count: 1 })),
        findUniqueOrThrow: vi.fn(async () => ({
          ...baseOrder,
          items: [{ id: "i1", productId: "p1", quantity: 1, product: { twinEnabled: true, tokenId: 1 } }],
        })),
      },
      product: { updateMany: vi.fn(async () => ({ count: 1 })) },
      nftMint: { createMany },
    };
    const deps = makeDeps({ db: fakeDb({ $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) }) });
    expect(await markOrderPaid(deps, "o1", "ref")).toBe(true);
    expect(createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
    expect(deps.kickMintWorker).toHaveBeenCalledOnce();
  });
});

describe("createCheckout", () => {
  it("rejects unknown products", async () => {
    const deps = makeDeps({ db: fakeDb({ product: { findMany: vi.fn(async () => []) } }) });
    await expect(
      createCheckout(deps, { items: [{ productId: "nope", quantity: 1 }], paymentMethod: "mock", email: "a@b.co" }, null),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects out-of-stock physical products before creating an order", async () => {
    const create = vi.fn();
    const deps = makeDeps({
      db: fakeDb({ product: { findMany: vi.fn(async () => [product({ stock: 1 })]) }, order: { create } }),
    });
    const err = await createCheckout(deps, { items: [{ productId: "p1", quantity: 2 }], paymentMethod: "mock", email: "a@b.co" }, null).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe("OUT_OF_STOCK");
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects disabled payment methods", async () => {
    const deps = makeDeps({ db: fakeDb({ product: { findMany: vi.fn(async () => [product()]) } }) });
    await expect(
      createCheckout(deps, { items: [{ productId: "p1", quantity: 1 }], paymentMethod: "stripe", email: "a@b.co" }, null),
    ).rejects.toMatchObject({ code: "PAYMENT_PROVIDER_UNAVAILABLE" });
  });
});
