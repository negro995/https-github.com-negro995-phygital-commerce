"use client";

import { Fingerprint, Plus } from "lucide-react";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { memberPrice, money } from "@/lib/format";
import type { Product } from "@/lib/types";
import { Badge, Button } from "./ui";

export function ProductImage({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  return src ? (
    <img src={src} alt={alt} loading="lazy" className={className ?? "aspect-square w-full object-cover"} />
  ) : (
    <div className={`${className ?? "aspect-square w-full"} grid place-items-center bg-gradient-to-br from-brand-100 to-fuchsia-100 text-3xl`} aria-hidden>
      ✦
    </div>
  );
}

export function ProductCard({ product, discountBps = 0 }: { product: Product; discountBps?: number }) {
  const { dispatch } = useCart();
  const soldOut = product.stock <= 0;
  const member = memberPrice(product.priceCents, discountBps);
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-ink-100 transition hover:shadow-md">
      <Link href={`/products/${product.slug}`} className="relative block overflow-hidden">
        <ProductImage src={product.imageUrl} alt={product.name} className="aspect-square w-full object-cover transition duration-300 group-hover:scale-105" />
        <div className="absolute left-2 top-2 flex gap-1">
          <Badge className={product.type === "DIGITAL" ? "bg-fuchsia-600 text-white" : "bg-white/90 text-ink-800"}>
            {product.type === "DIGITAL" ? "Digital" : "Physical"}
          </Badge>
        </div>
        {soldOut && <div className="absolute inset-0 grid place-items-center bg-white/70 text-sm font-semibold text-ink-800">Sold out</div>}
      </Link>
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <Link href={`/products/${product.slug}`} className="line-clamp-2 text-sm font-semibold text-ink-900 hover:text-brand-700 sm:text-base">
          {product.name}
        </Link>
        {product.twinEnabled && (
          <p className="mt-1 flex items-center gap-1 text-xs text-brand-700">
            <Fingerprint className="size-3.5" aria-hidden /> Includes Digital Twin
          </p>
        )}
        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <div>
            {discountBps > 0 ? (
              <>
                <p className="text-base font-bold text-ink-900">{money(member)}</p>
                <p className="text-xs text-ink-400 line-through">{money(product.priceCents)}</p>
              </>
            ) : (
              <p className="text-base font-bold text-ink-900">{money(product.priceCents)}</p>
            )}
          </div>
          <Button
            aria-label={`Add ${product.name} to cart`}
            className="size-11 rounded-full p-0"
            disabled={soldOut}
            onClick={() => dispatch({ type: "add", product })}
          >
            <Plus className="size-5" aria-hidden />
          </Button>
        </div>
      </div>
    </article>
  );
}
