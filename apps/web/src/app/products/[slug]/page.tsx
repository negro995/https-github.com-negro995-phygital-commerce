"use client";

import { ArrowLeft, Fingerprint, Minus, Plus, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ConciergeLauncher } from "@/components/concierge";
import { ProductImage } from "@/components/product-card";
import { Badge, Button, Notice, Skeleton } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { memberPrice, money } from "@/lib/format";
import type { Product } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, error, loading } = useApi<{ product: Product }>(`/api/products/${encodeURIComponent(slug)}`);
  const { me } = useAuth();
  const { dispatch } = useCart();
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const discountBps = me?.loyalty.tier.discountBps ?? 0;

  if (loading && !data) {
    return (
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:grid-cols-2">
        <Skeleton className="aspect-square" />
        <div className="space-y-3">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <Notice tone="error" title="Producto no disponible">
          {error ?? "No encontrado"}
        </Notice>
      </div>
    );
  }

  const { product } = data;
  const max = Math.min(20, product.stock);
  const add = (goToCart: boolean) => {
    dispatch({ type: "add", product, quantity: qty });
    if (goToCart) router.push("/cart");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-4 pb-32 sm:py-8 md:pb-8">
      <Link href="/" className="inline-flex min-h-11 items-center gap-1 text-sm text-ink-600 hover:text-ink-900">
        <ArrowLeft className="size-4" aria-hidden /> Volver a la tienda
      </Link>
      <div className="mt-2 grid gap-6 md:grid-cols-2 md:gap-10">
        <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-ink-100">
          <ProductImage src={product.imageUrl} alt={product.name} />
        </div>
        <div>
          <div className="flex gap-2">
            <Badge className={product.type === "DIGITAL" ? "bg-fuchsia-100 text-fuchsia-800" : undefined}>{product.type === "DIGITAL" ? "Digital" : "Físico"}</Badge>
            <Badge>{product.category}</Badge>
          </div>
          <h1 className="mt-3 text-2xl font-bold sm:text-3xl">{product.name}</h1>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold">{money(memberPrice(product.priceCents, discountBps))}</span>
            {discountBps > 0 && (
              <>
                <span className="text-ink-400 line-through">{money(product.priceCents)}</span>
                <Badge className="bg-emerald-100 text-emerald-800">
                  {me?.loyalty.tier.name} −{discountBps / 100}%
                </Badge>
              </>
            )}
          </div>
          <p className="mt-4 whitespace-pre-line text-ink-600">{product.description}</p>

          <ul className="mt-6 space-y-2 text-sm">
            {product.twinEnabled && (
              <li className="flex gap-2">
                <Fingerprint className="size-5 shrink-0 text-brand-600" aria-hidden />
                Después de la compra se emite a tu wallet un Gemelo Digital intransferible (token #{product.tokenId}): no se puede vender ni transferir.
              </li>
            )}
            {product.type === "PHYSICAL" && (
              <li className="flex gap-2">
                <ShieldCheck className="size-5 shrink-0 text-brand-600" aria-hidden />
                Incluye un pasaporte digital QR que certifica su autenticidad.
              </li>
            )}
          </ul>

          <p className="mt-6 text-sm text-ink-500">
            {product.stock > 0 ? (product.type === "PHYSICAL" && product.stock <= 10 ? `Quedan solo ${product.stock}` : "En stock") : "Agotado"}
          </p>

          <div className="fixed inset-x-0 bottom-0 z-20 border-t border-ink-100 bg-white p-3 md:static md:mt-4 md:border-0 md:bg-transparent md:p-0">
            <div className="mx-auto flex max-w-6xl items-center gap-2">
              <div className="flex items-center rounded-xl ring-1 ring-ink-200">
                <button className="grid size-11 place-items-center" aria-label="Restar cantidad" onClick={() => setQty((q) => Math.max(1, q - 1))}>
                  <Minus className="size-4" aria-hidden />
                </button>
                <span className="w-8 text-center text-sm font-semibold" aria-live="polite">
                  {qty}
                </span>
                <button className="grid size-11 place-items-center" aria-label="Sumar cantidad" onClick={() => setQty((q) => Math.min(max, q + 1))}>
                  <Plus className="size-4" aria-hidden />
                </button>
              </div>
              <Button variant="secondary" className="flex-1" disabled={max <= 0} onClick={() => add(false)}>
                Agregar al carrito
              </Button>
              <Button className="flex-1" disabled={max <= 0} onClick={() => add(true)}>
                Comprar ahora
              </Button>
            </div>
          </div>
        </div>
      </div>
      <ConciergeLauncher />
    </div>
  );
}
