"use client";

import { Bot, Plus, Send, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { money } from "@/lib/format";
import type { ConciergeResult, Product } from "@/lib/types";
import { ProductImage } from "./product-card";
import { Button, Notice, cx } from "./ui";

interface Turn {
  role: "user" | "assistant";
  content: string;
  result?: ConciergeResult;
}

const PROMPTS = ["A gift under $50", "What pairs with my last purchase?", "Show me digital collectibles", "How do I reach the next tier?"];

export function ConciergePanel({ onClose }: { onClose?: () => void }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { dispatch } = useCart();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [turns, sending]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || sending) return;
    const history = turns.slice(-10).map(({ role, content }) => ({ role, content }));
    setTurns((t) => [...t, { role: "user", content: message }]);
    setInput("");
    setSending(true);
    setError(null);
    try {
      const result = await api<ConciergeResult>("/api/ai/concierge", { method: "POST", json: { message, history } });
      setTurns((t) => [...t, { role: "assistant", content: result.reply, result }]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const addToCart = async (productId: string, slug: string) => {
    try {
      const { product } = await api<{ product: Product }>(`/api/products/${slug}`);
      dispatch({ type: "add", product });
    } catch (err) {
      setError(errorMessage(err));
    }
    void productId;
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-3">
        <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-brand-600 to-fuchsia-600 text-white">
          <Bot className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink-900">AI Concierge</p>
          <p className="text-xs text-ink-500">Personal picks · loyalty discounts auto-applied</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="grid size-10 place-items-center rounded-full hover:bg-ink-100" aria-label="Close concierge">
            <X className="size-5" aria-hidden />
          </button>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {turns.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-ink-600">Hi! I know the whole catalog and your purchase history — online and in-store. What are you looking for?</p>
            <div className="flex flex-wrap gap-2">
              {PROMPTS.map((p) => (
                <button key={p} onClick={() => void send(p)} className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100">
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
        {turns.map((turn, i) => (
          <div key={i} className={cx("flex", turn.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cx("max-w-[90%] space-y-2", turn.role === "user" && "text-right")}>
              <p
                className={cx(
                  "inline-block rounded-2xl px-3 py-2 text-left text-sm",
                  turn.role === "user" ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-900",
                )}
              >
                {turn.content}
              </p>
              {turn.result?.degraded && (
                <p className="text-xs text-amber-700">AI is busy right now — showing smart picks from our recommender instead.</p>
              )}
              {turn.result?.recommendations.map((r) => (
                <div key={r.productId} className="flex items-center gap-3 rounded-xl p-2 ring-1 ring-ink-100">
                  <ProductImage src={r.imageUrl} alt={r.name} className="size-14 shrink-0 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/products/${r.slug}`} className="line-clamp-1 text-sm font-semibold text-ink-900 hover:text-brand-700">
                      {r.name}
                    </Link>
                    <p className="line-clamp-2 text-xs text-ink-500">{r.reason}</p>
                    <p className="text-xs">
                      <span className="font-semibold text-ink-900">{money(r.memberPriceCents)}</span>
                      {r.memberPriceCents < r.priceCents && <span className="ml-1 text-ink-400 line-through">{money(r.priceCents)}</span>}
                    </p>
                  </div>
                  <button
                    onClick={() => void addToCart(r.productId, r.slug)}
                    className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-600 text-white hover:bg-brand-700"
                    aria-label={`Add ${r.name} to cart`}
                  >
                    <Plus className="size-4" aria-hidden />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
        {sending && <p className="text-xs text-ink-500">Concierge is thinking…</p>}
        {error && <Notice tone="error">{error}</Notice>}
        <div ref={endRef} />
      </div>

      <form
        className="flex gap-2 border-t border-ink-100 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask for a recommendation…"
          aria-label="Message the concierge"
          maxLength={2000}
          className="min-h-11 flex-1 rounded-xl bg-ink-50 px-3 text-sm ring-1 ring-ink-200 focus:ring-2 focus:ring-brand-500 focus:outline-none"
        />
        <Button type="submit" aria-label="Send" loading={sending} disabled={!input.trim()} className="w-11 px-0">
          {!sending && <Send className="size-4" aria-hidden />}
        </Button>
      </form>
    </div>
  );
}

export function ConciergeLauncher() {
  const [open, setOpen] = useState(false);
  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 sm:inset-auto sm:bottom-24 sm:right-6 sm:h-[600px] sm:w-[400px] sm:overflow-hidden sm:rounded-2xl sm:shadow-2xl sm:ring-1 sm:ring-ink-200">
          <ConciergePanel onClose={() => setOpen(false)} />
        </div>
      )}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex min-h-12 items-center gap-2 rounded-full bg-gradient-to-r from-brand-600 to-fuchsia-600 px-5 text-sm font-semibold text-white shadow-lg hover:shadow-xl sm:bottom-6 sm:right-6"
        >
          <Sparkles className="size-4" aria-hidden /> Ask AI
        </button>
      )}
    </>
  );
}
