"use client";

import Link from "next/link";
import { LoyaltyCard } from "@/components/loyalty-card";
import { MintStatusBadge, TxLink } from "@/components/mint-status";
import { ProductImage } from "@/components/product-card";
import { Badge, Button, Card, EmptyState, Notice, Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { dateTime, money } from "@/lib/format";
import type { Twin } from "@/lib/types";
import { useApi } from "@/lib/use-api";

interface OrderSummary {
  id: string;
  status: string;
  channel: "WEB" | "IN_STORE";
  totalCents: number;
  currency: string;
  createdAt: string;
  items: Array<{ quantity: number; product: { name: string } }>;
}

export default function AccountPage() {
  const { ready, signedIn, signIn, me, meError } = useAuth();
  const twins = useApi<{ twins: Twin[] }>(signedIn ? "/api/me/twins" : null, { refreshMs: 10_000, deps: [me?.user.id] });
  const orders = useApi<{ orders: OrderSummary[] }>(signedIn ? "/api/me/orders" : null, { deps: [me?.user.id] });

  if (!ready) return <Spinner />;
  if (!signedIn) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <EmptyState title="Sign in to see your rewards">
          <Button className="mt-2" onClick={signIn}>
            Sign in
          </Button>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[380px_1fr]">
      <div className="space-y-4">
        {meError && <Notice tone="error">{meError}</Notice>}
        {me ? <LoyaltyCard loyalty={me.loyalty} /> : <Spinner />}
      </div>
      <div className="space-y-6">
        <section>
          <h2 className="text-lg font-bold">Digital Twins</h2>
          {twins.error && <Notice tone="error">{twins.error}</Notice>}
          {twins.data && twins.data.twins.length === 0 && (
            <EmptyState title="No twins yet">
              Buy anything online or scan a product passport in-store to mint your first.
            </EmptyState>
          )}
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {twins.data?.twins.map((t) => (
              <Card key={t.id} className="p-0 sm:p-0">
                <ProductImage src={t.product.imageUrl} alt={t.product.name} className="aspect-square w-full rounded-t-2xl object-cover" />
                <div className="space-y-1 p-3">
                  <p className="line-clamp-1 text-sm font-semibold">{t.product.name}</p>
                  <div className="flex flex-wrap items-center gap-1">
                    <MintStatusBadge status={t.status} />
                    <Badge>{t.source === "ORDER" ? "Online" : "In-store"}</Badge>
                  </div>
                  <TxLink txHash={t.txHash} explorerUrl={t.explorerUrl} />
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold">Orders</h2>
          {orders.error && <Notice tone="error">{orders.error}</Notice>}
          {orders.data && orders.data.orders.length === 0 && <EmptyState title="No orders yet" />}
          <ul className="mt-3 space-y-2">
            {orders.data?.orders.map((o) => (
              <li key={o.id}>
                <Link href={`/orders/${o.id}`} className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-ink-100 hover:ring-brand-300">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{o.items.map((i) => `${i.quantity}× ${i.product.name}`).join(", ")}</p>
                    <p className="text-xs text-ink-500">
                      {dateTime(o.createdAt)} · {o.channel === "WEB" ? "Online" : "In-store"} · {o.status.replace("_", " ").toLowerCase()}
                    </p>
                  </div>
                  <p className="text-sm font-semibold">{money(o.totalCents, o.currency)}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
