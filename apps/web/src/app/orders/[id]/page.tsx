"use client";

import { CheckCircle2, Clock, Fingerprint, XCircle } from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CryptoPay } from "@/components/crypto-pay";
import { MintStatusBadge, TxLink } from "@/components/mint-status";
import { ProductImage } from "@/components/product-card";
import { Button, Card, Notice, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { useConfig } from "@/lib/config";
import { money } from "@/lib/format";
import type { OrderView } from "@/lib/types";
import { useApi } from "@/lib/use-api";

function needsPolling(order: OrderView | undefined) {
  if (!order) return true;
  if (order.status === "PENDING_PAYMENT") return true;
  return order.mints.some((m) => m.status === "PENDING" || m.status === "SUBMITTED");
}

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const { data, error, loading, reload } = useApi<{ order: OrderView }>(`/api/orders/${id}`, {
    refreshMs: 4_000,
    shouldPoll: (d) => needsPolling(d?.order),
  });
  const order = data?.order;
  const { config } = useConfig();
  const { dispatch } = useCart();
  const { refreshMe } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const paid = order?.status === "PAID" || order?.status === "FULFILLED";
  const allMinted = Boolean(order && order.mints.length > 0 && order.mints.every((m) => m.status === "CONFIRMED"));

  useEffect(() => {
    if (paid || search.get("status") === "success") dispatch({ type: "clear" });
  }, [paid, search, dispatch]);

  useEffect(() => {
    if (allMinted) void refreshMe();
  }, [allMinted, refreshMe]);

  if (loading && !order) return <Spinner label="Loading your order…" />;
  if (error && !order) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <Notice tone="error" title="Couldn't load this order" action={<Button variant="secondary" onClick={() => void reload()}>Retry</Button>}>
          {error}
        </Notice>
      </div>
    );
  }
  if (!order) return null;

  const confirmMock = async () => {
    setConfirming(true);
    setActionError(null);
    try {
      await api(`/api/orders/${order.id}/mock-confirm`, { method: "POST" });
      await reload();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-ink-500">Order #{order.id.slice(-8).toUpperCase()}</p>
        <h1 className="mt-1 text-2xl font-bold">
          {paid ? "Thank you! Your order is confirmed." : order.status === "PENDING_PAYMENT" ? "Complete your payment" : order.status === "CANCELLED" ? "Order cancelled" : "Payment failed"}
        </h1>
      </div>

      {search.get("status") === "cancelled" && order.status === "PENDING_PAYMENT" && (
        <Notice tone="warning" title="Payment was cancelled">You can retry below or return to your cart.</Notice>
      )}
      {error && <Notice tone="warning">Live updates paused: {error}</Notice>}

      <Card>
        <ol className="space-y-4">
          <li className="flex gap-3">
            {paid ? <CheckCircle2 className="size-6 text-emerald-600" aria-hidden /> : order.status === "PENDING_PAYMENT" ? <Clock className="size-6 text-amber-500" aria-hidden /> : <XCircle className="size-6 text-red-600" aria-hidden />}
            <div className="flex-1">
              <p className="font-semibold">Payment</p>
              <p className="text-sm text-ink-500">
                {paid
                  ? `Paid ${money(order.totalCents, order.currency)} via ${order.paymentMethod}`
                  : order.status === "PENDING_PAYMENT"
                    ? "Waiting for your payment…"
                    : "This payment didn't go through. No Digital Twin was minted and you were not charged."}
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <Fingerprint className={`size-6 ${allMinted ? "text-emerald-600" : "text-ink-400"}`} aria-hidden />
            <div className="flex-1">
              <p className="font-semibold">Digital Twins</p>
              <p className="text-sm text-ink-500">
                {!paid
                  ? "Minted to your wallet once payment is confirmed."
                  : order.mints.length === 0
                    ? "No twin-enabled items in this order."
                    : allMinted
                      ? "Minted on-chain. Your loyalty tier has been updated."
                      : "Minting in the background — you can leave this page, we'll keep retrying until it lands."}
              </p>
            </div>
          </li>
        </ol>
      </Card>

      {order.status === "PENDING_PAYMENT" && order.paymentMethod === "mock" && (
        <Card className="space-y-3">
          <Notice title="Demo payment">This store runs with mock payments enabled for local testing.</Notice>
          {actionError && <Notice tone="error">{actionError}</Notice>}
          <Button className="w-full" loading={confirming} onClick={() => void confirmMock()}>
            Complete demo payment
          </Button>
        </Card>
      )}

      {order.status === "PENDING_PAYMENT" && order.paymentMethod === "crypto" && (
        <Card>
          <h2 className="mb-3 font-semibold">Pay with USDC</h2>
          {config?.web3.usdc ? (
            <CryptoPay
              orderId={order.id}
              chainId={config.chainId}
              token={config.web3.usdc.token}
              recipient={config.web3.usdc.recipient}
              amount={(BigInt(order.totalCents) * 10_000n).toString()}
              onPaid={() => void reload()}
            />
          ) : (
            <Notice tone="warning">Crypto payments are temporarily unavailable. Your order is saved — please try again later.</Notice>
          )}
        </Card>
      )}

      {(order.status === "PAYMENT_FAILED" || order.status === "CANCELLED") && (
        <Link href="/cart" className="block">
          <Button className="w-full">Back to cart</Button>
        </Link>
      )}

      <Card>
        <h2 className="font-semibold">Items</h2>
        <ul className="mt-3 divide-y divide-ink-100">
          {order.items.map((item) => {
            const mints = order.mints.filter((m) => m.productId === item.product.id);
            return (
              <li key={item.id} className="flex gap-3 py-3">
                <ProductImage src={item.product.imageUrl} alt={item.product.name} className="size-16 shrink-0 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{item.product.name}</p>
                  <p className="text-xs text-ink-500">
                    {item.quantity} × {money(item.unitPriceCents, order.currency)}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {mints.map((m) => (
                      <span key={m.id} className="flex items-center gap-1.5">
                        <MintStatusBadge status={m.status} attempts={m.attempts} />
                        <TxLink txHash={m.txHash} explorerUrl={m.explorerUrl} />
                      </span>
                    ))}
                  </div>
                  {mints.some((m) => m.status === "FAILED") && (
                    <p className="mt-1 text-xs text-red-700">Minting failed — our team has been notified and will retry. Your purchase is safe.</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <dl className="mt-2 space-y-1 border-t border-ink-100 pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-600">Subtotal</dt>
            <dd>{money(order.subtotalCents, order.currency)}</dd>
          </div>
          {order.discountCents > 0 && (
            <div className="flex justify-between text-emerald-700">
              <dt>Loyalty discount ({order.discountBps / 100}%)</dt>
              <dd>−{money(order.discountCents, order.currency)}</dd>
            </div>
          )}
          <div className="flex justify-between font-bold">
            <dt>Total</dt>
            <dd>{money(order.totalCents, order.currency)}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
