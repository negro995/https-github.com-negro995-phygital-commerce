"use client";

import { Minus, Plus, Printer } from "lucide-react";
import { useState } from "react";
import { QrSvg } from "@/components/qr-svg";
import { Button, Card, Field, Notice, Spinner, cx, inputCls } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { money, shortAddress } from "@/lib/format";
import type { PosSaleResult, Product, Store } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export default function PosPage() {
  const products = useApi<{ products: Product[] }>("/api/admin/products");
  const stores = useApi<{ stores: Store[] }>("/api/admin/stores");
  const [storeId, setStoreId] = useState("");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [email, setEmail] = useState("");
  const [issuePassports, setIssuePassports] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PosSaleResult | null>(null);

  const selectedStore = storeId || stores.data?.stores[0]?.id || "";
  const catalog = products.data?.products.filter((p) => p.active) ?? [];
  const items = Object.entries(qty).filter(([, q]) => q > 0).map(([productId, quantity]) => ({ productId, quantity }));
  const total = items.reduce((s, i) => s + (catalog.find((p) => p.id === i.productId)?.priceCents ?? 0) * i.quantity, 0);
  const bump = (p: Product, d: number) => setQty((q) => ({ ...q, [p.id]: Math.max(0, Math.min(p.stock, (q[p.id] ?? 0) + d)) }));

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await api<PosSaleResult>("/api/admin/pos-sales", {
        method: "POST",
        json: { storeId: selectedStore, items, issuePassports, ...(email.trim() ? { customerEmail: email.trim() } : {}) },
      });
      setResult(res);
      setQty({});
      setEmail("");
      void products.reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-4">
        <div className="no-print space-y-3">
          <Notice tone="success" title={`Sale recorded · ${money(result.totalCents)}`}>
            {result.customerWallet
              ? `Digital Twins are minting to ${shortAddress(result.customerWallet)}.`
              : "Walk-in sale. Customers can scan the QR passports to claim their Digital Twins."}
          </Notice>
          <div className="flex gap-2">
            {result.passports.length > 0 && (
              <Button variant="secondary" onClick={() => window.print()}>
                <Printer className="size-4" aria-hidden /> Print passports
              </Button>
            )}
            <Button onClick={() => setResult(null)}>New sale</Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {result.passports.map((p) => (
            <Card key={p.code} className="flex flex-col items-center text-center">
              <QrSvg svg={p.qrSvg} label={`QR passport ${p.serial}`} className="size-36 bg-white" />
              <p className="mt-2 font-mono text-xs">{p.serial}</p>
              <p className="break-all text-[10px] text-ink-500">{p.url}</p>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-28 md:pb-0">
      <h1 className="text-2xl font-bold">In-store sale</h1>
      {(products.error || stores.error) && <Notice tone="error">{products.error ?? stores.error}</Notice>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Store">
          <select className={inputCls} value={selectedStore} onChange={(e) => setStoreId(e.target.value)}>
            {stores.data?.stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.city ? ` · ${s.city}` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Customer email (optional)" hint="Known customers get their Digital Twin minted immediately.">
          <input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="customer@example.com" />
        </Field>
      </div>
      {!products.data ? (
        <Spinner />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {catalog.map((p) => {
            const q = qty[p.id] ?? 0;
            return (
              <li key={p.id} className={cx("flex items-center gap-3 rounded-2xl bg-white p-3 ring-1", q > 0 ? "ring-2 ring-brand-500" : "ring-ink-100")}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.name}</p>
                  <p className="text-xs text-ink-500">
                    {money(p.priceCents)} · {p.stock} in stock
                  </p>
                </div>
                <div className="flex items-center">
                  <button className="grid size-10 place-items-center rounded-lg hover:bg-ink-100" aria-label={`Remove one ${p.name}`} onClick={() => bump(p, -1)}>
                    <Minus className="size-4" aria-hidden />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold">{q}</span>
                  <button className="grid size-10 place-items-center rounded-lg hover:bg-ink-100 disabled:opacity-40" aria-label={`Add one ${p.name}`} disabled={q >= p.stock} onClick={() => bump(p, 1)}>
                    <Plus className="size-4" aria-hidden />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-brand-600" checked={issuePassports} onChange={(e) => setIssuePassports(e.target.checked)} />
        Print QR digital passports for physical items
      </label>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-ink-100 bg-white p-3 md:static md:border-0 md:bg-transparent md:p-0">
        <Button className="w-full" disabled={items.length === 0 || !selectedStore} loading={submitting} onClick={() => void submit()}>
          Record sale · {money(total)}
        </Button>
      </div>
    </div>
  );
}
