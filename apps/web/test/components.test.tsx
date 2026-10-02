import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { LoyaltyCard } from "@/components/loyalty-card";
import { MintStatusBadge, TxLink } from "@/components/mint-status";
import { ProductCard } from "@/components/product-card";
import { CartProvider, useCart } from "@/lib/cart";
import { loyalty, product } from "./fixtures";

function CartCount() {
  const { count, subtotalCents } = useCart();
  return (
    <p data-testid="cart">
      {count}:{subtotalCents}
    </p>
  );
}

const withCart = (ui: ReactNode) =>
  render(
    <CartProvider>
      {ui}
      <CartCount />
    </CartProvider>,
  );

describe("MintStatusBadge", () => {
  it.each([
    ["PENDING", 0, "Queued"],
    ["SUBMITTED", 0, "Minting…"],
    ["CONFIRMED", 0, "Minted"],
    ["FAILED", 3, "Needs attention"],
  ] as const)("renders %s", (status, attempts, label) => {
    render(<MintStatusBadge status={status} attempts={attempts} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("shows retry progress for pending jobs that already failed once", () => {
    render(<MintStatusBadge status="PENDING" attempts={2} />);
    expect(screen.getByText("Retrying (attempt 3)")).toBeInTheDocument();
  });

  it("links transactions to the explorer when available", () => {
    const hash = `0x${"ab".repeat(32)}`;
    render(<TxLink txHash={hash} explorerUrl={`https://basescan.org/tx/${hash}`} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", `https://basescan.org/tx/${hash}`);
  });
});

describe("LoyaltyCard", () => {
  it("shows tier, discount and progress to the next tier", () => {
    render(<LoyaltyCard loyalty={loyalty(2)} />);
    expect(screen.getByText("Loyalty tier").nextElementSibling).toHaveTextContent("Insider");
    expect(screen.getByText("5% off auto-applied at checkout")).toBeInTheDocument();
    expect(screen.getByText(/3 more to reach VIP/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "40");
  });

  it("explains the database fallback when the chain is unavailable", () => {
    render(<LoyaltyCard loyalty={loyalty(0, { source: "database" })} />);
    expect(screen.getByText(/chain temporarily unavailable/)).toBeInTheDocument();
    expect(screen.getByText(/Earn your first Digital Twin/)).toBeInTheDocument();
  });

  it("celebrates the top tier", () => {
    render(<LoyaltyCard loyalty={loyalty(20)} />);
    expect(screen.getByText(/Top tier reached/)).toBeInTheDocument();
  });
});

describe("ProductCard", () => {
  it("shows the member price and adds to cart", async () => {
    withCart(<ProductCard product={product()} discountBps={1_000} />);
    expect(screen.getByText("$36.00")).toBeInTheDocument();
    expect(screen.getByText("$40.00")).toBeInTheDocument();
    expect(screen.getByText("Includes Digital Twin")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Add Cold Brew Kit to cart" }));
    expect(screen.getByTestId("cart")).toHaveTextContent("1:4000");
  });

  it("disables sold-out products", () => {
    withCart(<ProductCard product={product({ stock: 0 })} />);
    expect(screen.getByText("Sold out")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add cold brew kit/i })).toBeDisabled();
  });
});
