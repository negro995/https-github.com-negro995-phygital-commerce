import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, apiRequest, errorMessage, setAuthHeaderSource } from "@/lib/api";
import { jsonResponse } from "./fixtures";

afterEach(() => {
  vi.unstubAllGlobals();
  setAuthHeaderSource(async () => ({}));
});

describe("api client", () => {
  it("sends JSON bodies with auth headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    setAuthHeaderSource(async () => ({ "x-demo-email": "a@b.co" }));

    await expect(api("/api/checkout", { method: "POST", json: { a: 1 } })).resolves.toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("http://localhost:4000/api/checkout");
    expect(init.body).toBe('{"a":1}');
    expect(init.headers).toMatchObject({ "content-type": "application/json", "x-demo-email": "a@b.co" });
  });

  it("maps structured API errors to ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: { code: "OUT_OF_STOCK", message: "Only 1 left" } }, 409)),
    );
    const err = await api("/api/checkout").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ code: "OUT_OF_STOCK", status: 409, message: "Only 1 left" });
  });

  it("turns network failures into a friendly NETWORK error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const err = await api("/api/products").catch((e: unknown) => e);
    expect(err).toMatchObject({ code: "NETWORK", status: 0 });
    expect(errorMessage(err)).toMatch(/no pudimos conectarnos con la tienda/i);
  });

  it("handles non-JSON error bodies", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>bad gateway</html>", { status: 502 })));
    await expect(api("/api/products")).rejects.toMatchObject({ code: "INTERNAL", status: 502 });
  });

  it("exposes the HTTP status for accepted-but-pending responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ status: "pending" }, 202)));
    await expect(apiRequest("/api/orders/o1/crypto-confirm", { method: "POST", json: {} })).resolves.toEqual({
      status: 202,
      data: { status: "pending" },
    });
  });
});
