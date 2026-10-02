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
    ["PENDING", 0, "En cola"],
    ["SUBMITTED", 0, "Emitiendo…"],
    ["CONFIRMED", 0, "Emitido"],
    ["FAILED", 3, "Requiere atención"],
  ] as const)("renders %s", (status, attempts, label) => {
    render(<MintStatusBadge status={status} attempts={attempts} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("shows retry progress for pending jobs that already failed once", () => {
    render(<MintStatusBadge status="PENDING" attempts={2} />);
    expect(screen.getByText("Reintentando (intento 3)")).toBeInTheDocument();
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
    expect(screen.getByText("Nivel de fidelidad").nextElementSibling).toHaveTextContent("Socio");
    expect(screen.getByText("5% de descuento aplicado automáticamente al pagar")).toBeInTheDocument();
    expect(screen.getByText(/Te faltan 3 para llegar a VIP/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "40");
  });

  it("explains the database fallback when the chain is unavailable", () => {
    render(<LoyaltyCard loyalty={loyalty(0, { source: "database" })} />);
    expect(screen.getByText(/blockchain no disponible por el momento/)).toBeInTheDocument();
    expect(screen.getByText(/Conseguí tu primer Gemelo Digital/)).toBeInTheDocument();
  });

  it("celebrates the top tier", () => {
    render(<LoyaltyCard loyalty={loyalty(20)} />);
    expect(screen.getByText(/Llegaste al nivel máximo/)).toBeInTheDocument();
  });
});

describe("ProductCard", () => {
  it("shows the member price and adds to cart", async () => {
    withCart(<ProductCard product={product()} discountBps={1_000} />);
    expect(screen.getByText(/^US\$\s36,00$/)).toBeInTheDocument();
    expect(screen.getByText(/^US\$\s40,00$/)).toBeInTheDocument();
    expect(screen.getByText("Incluye Gemelo Digital")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Agregar Cold Brew Kit al carrito" }));
    expect(screen.getByTestId("cart")).toHaveTextContent("1:4000");
  });

  it("disables sold-out products", () => {
    withCart(<ProductCard product={product({ stock: 0 })} />);
    expect(screen.getByText("Agotado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /agregar cold brew kit/i })).toBeDisabled();
  });
});
