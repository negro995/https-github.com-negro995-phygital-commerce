import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import { loadConfig } from "../src/config";
import { fakeDb, makeDeps, product, user } from "./helpers";

const json = { "content-type": "application/json" };

describe("API routes", () => {
  it("reports degraded health when the database is down", async () => {
    const app = createApp(makeDeps({ db: fakeDb({ $queryRaw: vi.fn(async () => Promise.reject(new Error("down"))) }) }));
    const res = await app.request("/health");
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ ok: false, database: "unreachable", payments: ["mock"], ai: "fallback" });
  });

  it("returns a JSON 404 for unknown routes", async () => {
    const res = await createApp(makeDeps()).request("/api/nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: "NOT_FOUND", message: "Route not found" } });
  });

  it("lists products", async () => {
    const findMany = vi.fn(async () => [product()]);
    const res = await createApp(makeDeps({ db: fakeDb({ product: { findMany } }) })).request("/api/products?type=DIGITAL");
    expect(res.status).toBe(200);
    expect(((await res.json()) as { products: unknown[] }).products).toHaveLength(1);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ active: true, type: "DIGITAL" }) }));
  });

  it("validates checkout payloads", async () => {
    const res = await createApp(makeDeps()).request("/api/checkout", {
      method: "POST",
      headers: json,
      body: JSON.stringify({ email: "not-an-email", items: [], paymentMethod: "mock" }),
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("BAD_REQUEST");
  });

  it("rejects invalid JSON bodies", async () => {
    const res = await createApp(makeDeps()).request("/api/checkout", { method: "POST", headers: json, body: "{" });
    expect(res.status).toBe(400);
  });

  it("requires sign-in for /me and a manager role for /admin", async () => {
    const upsert = vi.fn(async () => user());
    const app = createApp(makeDeps({ db: fakeDb({ user: { upsert } }) }));
    expect((await app.request("/api/me")).status).toBe(401);
    expect((await app.request("/api/admin/stats")).status).toBe(401);
    expect((await app.request("/api/admin/stats", { headers: { "x-demo-email": "ana@test.dev" } })).status).toBe(403);
  });

  it("returns 503 for webhooks of unconfigured providers", async () => {
    const app = createApp(makeDeps());
    expect((await app.request("/api/webhooks/stripe", { method: "POST", body: "{}" })).status).toBe(503);
    expect((await app.request("/api/webhooks/mercadopago", { method: "POST", body: "{}" })).status).toBe(503);
  });

  it("refuses crypto confirmation when crypto payments are disabled", async () => {
    const res = await createApp(makeDeps()).request("/api/orders/o1/crypto-confirm", {
      method: "POST",
      headers: json,
      body: JSON.stringify({ txHash: `0x${"a".repeat(64)}` }),
    });
    expect(res.status).toBe(503);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("PAYMENT_PROVIDER_UNAVAILABLE");
  });
});

describe("loadConfig", () => {
  it("refuses dev auth in production", () => {
    expect(() => loadConfig({ NODE_ENV: "production", AUTH_MODE: "dev" })).toThrow(/not allowed in production/);
  });

  it("requires Privy credentials in privy mode", () => {
    expect(() => loadConfig({ AUTH_MODE: "privy" })).toThrow(/PRIVY_APP_ID/);
  });

  it("parses admin emails and CORS origins", () => {
    const cfg = loadConfig({ ADMIN_EMAILS: " Boss@Shop.com ,x@y.z", CORS_ORIGINS: "http://a.com, http://b.com" });
    expect([...cfg.adminEmails]).toEqual(["boss@shop.com", "x@y.z"]);
    expect(cfg.corsOrigins).toEqual(["http://a.com", "http://b.com"]);
  });
});
