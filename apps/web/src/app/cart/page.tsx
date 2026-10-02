"use client";

import type { PaymentMethod } from "@phygital/shared";
import { Bitcoin, CreditCard, FlaskConical, Minus, Plus, Trash2, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ProductImage } from "@/components/product-card";
import { Button, Card, EmptyState, Field, Notice, cx, inputCls } from "@/components/ui";
import { ApiError, api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { useConfig } from "@/lib/config";
import { money } from "@/lib/format";
import type { CheckoutResult } from "@/lib/types";

const METHOD_INFO: Record<PaymentMethod, { label: string; hint: string; icon: typeof CreditCard }> = {
  stripe: { label: "Card / Apple Pay", hint: "Secure checkout by Stripe", icon: CreditCard },
  mercadopago: { label: "Mercado Pago", hint: "Cards, cash & local methods", icon: Wallet },
  crypto: { label: "USDC", hint: "Pay from any EVM wallet", icon: Bitcoin },
  mock: { label: "Demo payment", hint: "Instant test payment (dev only)", icon: FlaskConical },
};

export default function CartPage() {
  const { lines, subtotalCents, dispatch } = useCart();
  const { me, signedIn, signIn } = useAuth();
  const { config, error: configError } = useConfig();
  const router = useRouter();
  const [emailInput, setEmail] = useState("");
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const email = me?.user.email ?? emailInput;

  const methods = config?.paymentMethods ?? [];
  const selected = method && methods.includes(method) ? method : (methods[0] ?? null);
  const discountBps = me?.loyalty.tier.discountBps ?? 0;
  const estDiscount = Math.floor((subtotalCents * discountBps) / 10_000);

  const checkout = async () => {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await api<CheckoutResult>("/api/checkout", {
        method: "POST",
        json: { email, paymentMethod: selected, items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })) },
      });
      if (result.payment.type === "redirect") {
        window.location.assign(result.payment.url);
        return;
      }
      router.push(`/orders/${result.orderId}`);
    } catch (err) {
      setError(err instanceof ApiError && err.code === "OUT_OF_STOCK" ? `${err.message}. Adjust the quantity and try again.` : errorMessage(err));
      setSubmitting(false);
    }
  };

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <EmptyState title="Your cart is empty">
          <Link href="/" className="font-semibold text-brand-700 hover:underline">
            Browse products
          </Link>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[1fr_380px]">
      <section>
        <h1 className="text-2xl font-bold">Your cart</h1>
        <ul className="mt-4 space-y-3">
          {lines.map((l) => (
            <li key={l.productId} className="flex gap-3 rounded-2xl bg-white p-3 ring-1 ring-ink-100">
              <ProductImage src={l.imageUrl} alt={l.name} className="size-20 shrink-0 rounded-xl object-cover" />
              <div className="flex min-w-0 flex-1 flex-col">
                <Link href={`/products/${l.slug}`} className="line-clamp-2 text-sm font-semibold hover:text-brand-700">
                  {l.name}
                </Link>
                <p className="text-xs text-ink-500">
                  {money(l.unitPriceCents)} · {l.type === "DIGITAL" ? "Digital" : "Physical"}
                </p>
                <div className="mt-auto flex items-center gap-2 pt-2">
                  <div className="flex items-center rounded-lg ring-1 ring-ink-200">
                    <button className="grid size-9 place-items-center" aria-label={`Decrease ${l.name}`} onClick={() => dispatch({ type: "setQuantity", productId: l.productId, quantity: l.quantity - 1 })}>
                      <Minus className="size-3.5" aria-hidden />
                    </button>
                    <span className="w-6 text-center text-sm">{l.quantity}</span>
                    <button className="grid size-9 place-items-center" aria-label={`Increase ${l.name}`} onClick={() => dispatch({ type: "setQuantity", productId: l.productId, quantity: l.quantity + 1 })}>
                      <Plus className="size-3.5" aria-hidden />
                    </button>
                  </div>
                  <button className="ml-auto grid size-9 place-items-center rounded-lg text-ink-500 hover:bg-ink-100" aria-label={`Remove ${l.name}`} onClick={() => dispatch({ type: "remove", productId: l.productId })}>
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              </div>
              <p className="text-sm font-semibold">{money(l.unitPriceCents * l.quantity)}</p>
            </li>
          ))}
        </ul>
      </section>

      <aside>
        <Card className="space-y-4 lg:sticky lg:top-20">
          <h2 className="font-semibold">Checkout</h2>
          {!signedIn && (
            <Notice title="Earn a Digital Twin for this order" action={<Button variant="secondary" onClick={signIn}>Sign in</Button>}>
              Members get automatic loyalty discounts. Or continue as guest — we&apos;ll create a wallet for your email.
            </Notice>
          )}
          <Field label="Email" hint="Your receipt and Digital Twin wallet are linked to this email.">
            <input type="email" required className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} disabled={Boolean(me)} placeholder="you@example.com" />
          </Field>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink-700">Payment method</legend>
            {configError && <Notice tone="error">Payment options unavailable: {configError}</Notice>}
            {config && methods.length === 0 && <Notice tone="warning">No payment methods are configured on this store yet.</Notice>}
            <div className="grid gap-2">
              {methods.map((m) => {
                const { label, hint, icon: Icon } = METHOD_INFO[m];
                return (
                  <label key={m} className={cx("flex min-h-14 cursor-pointer items-center gap-3 rounded-xl p-3 ring-1", selected === m ? "bg-brand-50 ring-2 ring-brand-500" : "ring-ink-200")}>
                    <input type="radio" name="method" className="sr-only" checked={selected === m} onChange={() => setMethod(m)} />
                    <Icon className="size-5 text-brand-700" aria-hidden />
                    <span>
                      <span className="block text-sm font-semibold">{label}</span>
                      <span className="block text-xs text-ink-500">{hint}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <dl className="space-y-1 border-t border-ink-100 pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-600">Subtotal</dt>
              <dd>{money(subtotalCents)}</dd>
            </div>
            {discountBps > 0 && (
              <div className="flex justify-between text-emerald-700">
                <dt>
                  {me?.loyalty.tier.name} discount ({discountBps / 100}%)
                </dt>
                <dd>−{money(estDiscount)}</dd>
              </div>
            )}
            <div className="flex justify-between text-base font-bold">
              <dt>Total</dt>
              <dd>{money(subtotalCents - estDiscount)}</dd>
            </div>
            <p className="text-xs text-ink-500">Final total and loyalty discount are verified by the server at checkout.</p>
          </dl>

          {error && <Notice tone="error">{error}</Notice>}
          <Button className="w-full" loading={submitting} disabled={!selected || !email.includes("@")} onClick={() => void checkout()}>
            Place order
          </Button>
        </Card>
      </aside>
    </div>
  );
}
