"use client";

import Link from "next/link";
import { Badge, Card, Notice, Skeleton } from "@/components/ui";
import { MINT_STATUS_LABELS, dateTime, money, orderStatusLabel } from "@/lib/format";
import type { AdminStats } from "@/lib/types";
import { useApi } from "@/lib/use-api";

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-ink-500">{sub}</p>}
    </Card>
  );
}

export default function AdminOverview() {
  const { data, error } = useApi<AdminStats>("/api/admin/stats", { refreshMs: 15_000 });

  if (error && !data) return <Notice tone="error" title="No pudimos cargar las estadísticas">{error}</Notice>;
  if (!data) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }
  const total = data.sales.web.revenueCents + data.sales.inStore.revenueCents;
  const storeShare = total ? Math.round((data.sales.inStore.revenueCents / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Resumen</h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={`Ingresos (${data.windowDays} días)`} value={money(total)} sub={`${storeShare}% en el local`} />
        <Stat label="Ventas web" value={money(data.sales.web.revenueCents)} sub={`${data.sales.web.orders} pedidos`} />
        <Stat label="Ventas en el local" value={money(data.sales.inStore.revenueCents)} sub={`${data.sales.inStore.orders} pedidos`} />
        <Stat label="Clientes" value={String(data.customers)} sub={`${data.passports.claimed}/${data.passports.issued} pasaportes reclamados`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Emisiones de Gemelos Digitales</h2>
            <Link href="/admin/mints" className="text-sm font-medium text-brand-700 hover:underline">
              Ver cola
            </Link>
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
            {(["CONFIRMED", "PENDING", "SUBMITTED", "FAILED", "SKIPPED"] as const).map((s) => (
              <div key={s} className="rounded-xl bg-ink-50 p-2">
                <dd className={`text-xl font-bold ${s === "FAILED" && data.mints[s] > 0 ? "text-red-600" : ""}`}>{data.mints[s]}</dd>
                <dt className="text-[11px] text-ink-500">{MINT_STATUS_LABELS[s]}</dt>
              </div>
            ))}
          </dl>
          {data.mints.FAILED > 0 && (
            <div className="mt-3">
              <Notice tone="warning">{data.mints.FAILED} emisión(es) requieren atención. Reintentalas desde la cola.</Notice>
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Stock bajo</h2>
            <Link href="/admin/inventory" className="text-sm font-medium text-brand-700 hover:underline">
              Inventario
            </Link>
          </div>
          {data.lowStock.length === 0 ? (
            <p className="mt-3 text-sm text-ink-500">Todos los productos físicos tienen buen stock.</p>
          ) : (
            <ul className="mt-3 divide-y divide-ink-100">
              {data.lowStock.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="truncate">{p.name}</span>
                  <Badge className={p.stock === 0 ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}>quedan {p.stock}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="font-semibold">Pedidos recientes</h2>
        <ul className="mt-3 divide-y divide-ink-100">
          {data.recentOrders.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
              <Badge className={o.channel === "IN_STORE" ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800"}>{o.channel === "IN_STORE" ? "Local" : "Web"}</Badge>
              <span className="min-w-0 flex-1 truncate">{o.email ?? "Cliente sin registrar"}</span>
              <span className="text-xs text-ink-500">{orderStatusLabel(o.status)}</span>
              <span className="font-semibold">{money(o.totalCents)}</span>
              <span className="w-full text-xs text-ink-400 sm:w-auto">{dateTime(o.createdAt)}</span>
            </li>
          ))}
          {data.recentOrders.length === 0 && <li className="py-2 text-sm text-ink-500">Todavía no hay pedidos.</li>}
        </ul>
      </Card>
    </div>
  );
}
