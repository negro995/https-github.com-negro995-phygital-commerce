import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConciergePanel } from "@/components/concierge";
import { CryptoPay } from "@/components/crypto-pay";
import { CartProvider } from "@/lib/cart";
import { walletErrorMessage } from "@/lib/crypto-pay";
import type { ConciergeResult } from "@/lib/types";
import { jsonResponse } from "./fixtures";

afterEach(() => vi.unstubAllGlobals());

const reply = (overrides: Partial<ConciergeResult> = {}): ConciergeResult => ({
  reply: "Here are a few picks for you.",
  recommendations: [
    {
      productId: "p1",
      slug: "cold-brew-kit",
      name: "Cold Brew Kit",
      reason: "Matches your love of coffee",
      priceCents: 4_000,
      memberPriceCents: 3_800,
      imageUrl: null,
      type: "PHYSICAL",
    },
  ],
  loyalty: { tier: "INSIDER", tierName: "Insider", discountBps: 500, autoApplied: true, twinCount: 2 },
  source: "openai",
  degraded: false,
  ...overrides,
});

describe("ConciergePanel", () => {
  it("sends the message and renders recommendations with member pricing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(reply()));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <CartProvider>
        <ConciergePanel />
      </CartProvider>,
    );

    await userEvent.type(screen.getByLabelText("Message the concierge"), "I love coffee");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Here are a few picks for you.")).toBeInTheDocument();
    expect(screen.getByText("Cold Brew Kit")).toBeInTheDocument();
    expect(screen.getByText("$38.00")).toBeInTheDocument();
    const [, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ message: "I love coffee", history: [] });
  });

  it("flags degraded fallback answers", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(reply({ degraded: true, source: "fallback" }))));
    render(
      <CartProvider>
        <ConciergePanel />
      </CartProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "A gift under $50" }));
    expect(await screen.findByText(/showing smart picks from our recommender/)).toBeInTheDocument();
  });

  it("shows an error when the API is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    render(
      <CartProvider>
        <ConciergePanel />
      </CartProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "A gift under $50" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/can't reach the store/i);
  });
});

describe("CryptoPay", () => {
  const props = {
    orderId: "o1",
    chainId: 31337,
    token: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    recipient: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    amount: "38000000",
  };
  const txHash = `0x${"cd".repeat(32)}`;

  it("shows the amount and falls back to manual tx entry without a browser wallet", () => {
    render(<CryptoPay {...props} onPaid={vi.fn()} />);
    expect(screen.getByText("38.00 USDC")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /no browser wallet detected/i })).toBeDisabled();
  });

  it("verifies a pasted transaction hash and reports success", async () => {
    const onPaid = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: "paid" }));
    vi.stubGlobal("fetch", fetchMock);
    render(<CryptoPay {...props} onPaid={onPaid} />);

    await userEvent.type(screen.getByPlaceholderText("0x…"), txHash);
    await userEvent.click(screen.getByRole("button", { name: "Verify transaction" }));

    await waitFor(() => expect(onPaid).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toContain("/api/orders/o1/crypto-confirm");
    expect(JSON.parse(init.body as string)).toEqual({ txHash });
  });

  it("keeps the order recoverable when verification fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: { code: "PAYMENT_FAILED", message: "Transfer amount too low" } }, 402)),
    );
    render(<CryptoPay {...props} onPaid={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText("0x…"), txHash);
    await userEvent.click(screen.getByRole("button", { name: "Verify transaction" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Transfer amount too low");
    expect(screen.getByRole("button", { name: "Check again" })).toBeInTheDocument();
  });
});

describe("walletErrorMessage", () => {
  it("maps user rejection and unknown chains to friendly copy", () => {
    expect(walletErrorMessage({ code: 4001, message: "User rejected the request" })).toMatch(/cancelled/);
    expect(walletErrorMessage({ code: 4902 })).toMatch(/network/);
    expect(walletErrorMessage(new Error("boom"))).toBe("boom");
  });
});
