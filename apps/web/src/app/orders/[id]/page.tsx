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
import { money, paymentMethodLabel } from "@/lib/format";
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

  if (loading && !order) return <Spinner label="Cargando tu pedido…" />;
  if (error && !order) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <Notice tone="error" title="No pudimos cargar este pedido" action={<Button variant="secondary" onClick={() => void reload()}>Reintentar</Button>}>
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
        <p className="text-xs uppercase tracking-wider text-ink-500">Pedido #{order.id.slice(-8).toUpperCase()}</p>
        <h1 className="mt-1 text-2xl font-bold">
          {paid ? "¡Gracias! Tu pedido está confirmado." : order.status === "PENDING_PAYMENT" ? "Completá tu pago" : order.status === "CANCELLED" ? "Pedido cancelado" : "El pago falló"}
        </h1>
      </div>

      {search.get("status") === "cancelled" && order.status === "PENDING_PAYMENT" && (
        <Notice tone="warning" title="El pago fue cancelado">Podés reintentar abajo o volver a tu carrito.</Notice>
      )}
      {error && <Notice tone="warning">Actualizaciones en vivo en pausa: {error}</Notice>}

      <Card>
        <ol className="space-y-4">
          <li className="flex gap-3">
            {paid ? <CheckCircle2 className="size-6 text-emerald-600" aria-hidden /> : order.status === "PENDING_PAYMENT" ? <Clock className="size-6 text-amber-500" aria-hidden /> : <XCircle className="size-6 text-red-600" aria-hidden />}
            <div className="flex-1">
              <p className="font-semibold">Pago</p>
              <p className="text-sm text-ink-500">
                {paid
                  ? `Pagaste ${money(order.totalCents, order.currency)} con ${paymentMethodLabel(order.paymentMethod)}`
                  : order.status === "PENDING_PAYMENT"
                    ? "Esperando tu pago…"
                    : "El pago no se completó. No se emitió ningún Gemelo Digital y no se te cobró nada."}
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <Fingerprint className={`size-6 ${allMinted ? "text-emerald-600" : "text-ink-400"}`} aria-hidden />
            <div className="flex-1">
              <p className="font-semibold">Gemelos Digitales</p>
              <p className="text-sm text-ink-500">
                {!paid
                  ? "Se emiten a tu wallet cuando se confirma el pago."
                  : order.mints.length === 0
                    ? "Este pedido no tiene productos con Gemelo Digital."
                    : allMinted
                      ? "Emitidos en blockchain. Tu nivel de fidelidad ya se actualizó."
                      : "Emitiendo en segundo plano: podés salir de esta página, vamos a seguir intentando hasta que se complete."}
              </p>
            </div>
          </li>
        </ol>
      </Card>

      {order.status === "PENDING_PAYMENT" && order.paymentMethod === "mock" && (
        <Card className="space-y-3">
          <Notice title="Pago de prueba">Esta tienda tiene habilitados pagos de prueba para testing local.</Notice>
          {actionError && <Notice tone="error">{actionError}</Notice>}
          <Button className="w-full" loading={confirming} onClick={() => void confirmMock()}>
            Completar pago de prueba
          </Button>
        </Card>
      )}

      {order.status === "PENDING_PAYMENT" && order.paymentMethod === "crypto" && (
        <Card>
          <h2 className="mb-3 font-semibold">Pagar con USDC</h2>
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
            <Notice tone="warning">Los pagos con cripto no están disponibles por el momento. Tu pedido quedó guardado: probá de nuevo más tarde.</Notice>
          )}
        </Card>
      )}

      {(order.status === "PAYMENT_FAILED" || order.status === "CANCELLED") && (
        <Link href="/cart" className="block">
          <Button className="w-full">Volver al carrito</Button>
        </Link>
      )}

      <Card>
        <h2 className="font-semibold">Productos</h2>
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
                    <p className="mt-1 text-xs text-red-700">La emisión falló: nuestro equipo ya fue notificado y lo va a reintentar. Tu compra está segura.</p>
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
              <dt>Descuento por fidelidad ({order.discountBps / 100}%)</dt>
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
