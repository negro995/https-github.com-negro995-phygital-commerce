"use client";

import { Fingerprint, QrCode, Search, Sparkles } from "lucide-react";
import { useState } from "react";
import { ConciergeLauncher } from "@/components/concierge";
import { ProductCard } from "@/components/product-card";
import { Button, EmptyState, Notice, Skeleton, cx, inputCls } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import type { Product } from "@/lib/types";
import { useApi } from "@/lib/use-api";

const FILTERS = [
  { id: "", label: "All" },
  { id: "PHYSICAL", label: "Physical" },
  { id: "DIGITAL", label: "Digital" },
] as const;

export default function StorefrontPage() {
  const [type, setType] = useState<"" | "PHYSICAL" | "DIGITAL">("");
  const [q, setQ] = useState("");
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (q.trim()) params.set("q", q.trim());
  const { data, error, loading, reload } = useApi<{ products: Product[] }>(`/api/products?${params}`);
  const { me, signedIn, signIn } = useAuth();
  const discountBps = me?.loyalty.tier.discountBps ?? 0;

  return (
    <>
      <section className="bg-gradient-to-br from-brand-700 via-brand-600 to-fuchsia-600 text-white">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:py-16">
          <p className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
            <Sparkles className="size-3.5" aria-hidden /> Shop online or in-store — every purchase counts
          </p>
          <h1 className="mt-4 max-w-2xl text-3xl font-extrabold leading-tight sm:text-5xl">Own the real thing. Collect its Digital Twin.</h1>
          <p className="mt-3 max-w-xl text-white/85 sm:text-lg">
            Each purchase mints a soulbound Digital Twin to your wallet — created automatically, no crypto know-how needed. Twins unlock member
            discounts and perks.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {signedIn && me ? (
              <span className="rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold">
                {me.loyalty.tier.name} · {me.loyalty.twinCount} twins
                {discountBps > 0 && ` · ${discountBps / 100}% off applied`}
              </span>
            ) : (
              <Button variant="secondary" onClick={signIn}>
                Sign in to earn rewards
              </Button>
            )}
          </div>
          <dl className="mt-8 grid grid-cols-3 gap-3 text-xs sm:max-w-xl sm:text-sm">
            {[
              { icon: Fingerprint, t: "Digital Twins", d: "Soulbound proof of ownership" },
              { icon: QrCode, t: "QR passports", d: "Scan in-store items" },
              { icon: Sparkles, t: "AI concierge", d: "Picks made for you" },
            ].map(({ icon: Icon, t, d }) => (
              <div key={t} className="rounded-xl bg-white/10 p-3">
                <Icon className="size-5" aria-hidden />
                <dt className="mt-2 font-semibold">{t}</dt>
                <dd className="text-white/75">{d}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Product type">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                role="tab"
                aria-selected={type === f.id}
                onClick={() => setType(f.id)}
                className={cx(
                  "min-h-10 shrink-0 rounded-full px-4 text-sm font-medium ring-1",
                  type === f.id ? "bg-ink-900 text-white ring-ink-900" : "bg-white text-ink-700 ring-ink-200 hover:bg-ink-50",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative sm:ml-auto sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" aria-label="Search products" className={`${inputCls} pl-9`} />
          </div>
        </div>

        <div className="mt-6">
          {error ? (
            <Notice tone="error" title="We couldn't load the catalog" action={<Button variant="secondary" onClick={() => void reload()}>Retry</Button>}>
              {error}
            </Notice>
          ) : loading && !data ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className="aspect-[3/4]" />
              ))}
            </div>
          ) : data && data.products.length === 0 ? (
            <EmptyState title="No products found">Try a different search or filter.</EmptyState>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
              {data?.products.map((p) => <ProductCard key={p.id} product={p} discountBps={discountBps} />)}
            </div>
          )}
        </div>
      </section>
      <ConciergeLauncher />
    </>
  );
}
