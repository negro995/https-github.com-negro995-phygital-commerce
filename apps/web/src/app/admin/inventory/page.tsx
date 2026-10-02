"use client";

import { PRODUCT_TYPES } from "@phygital/shared";
import { Plus, Save } from "lucide-react";
import { useState } from "react";
import { ProductImage } from "@/components/product-card";
import { Badge, Button, Card, Field, Notice, Spinner, inputCls } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { money } from "@/lib/format";
import type { Product } from "@/lib/types";
import { useApi } from "@/lib/use-api";

function ProductRow({ product, onSaved }: { product: Product; onSaved: () => void }) {
  const [stock, setStock] = useState(String(product.stock));
  const [price, setPrice] = useState((product.priceCents / 100).toFixed(2));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = stock !== String(product.stock) || price !== (product.priceCents / 100).toFixed(2);

  const save = async (patch: Record<string, unknown>) => {
    setSaving(true);
    setError(null);
    try {
      await api(`/api/admin/products/${product.id}`, { method: "PATCH", json: patch });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <ProductImage src={product.imageUrl} alt={product.name} className="size-12 shrink-0 rounded-lg object-cover" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{product.name}</p>
          <div className="flex flex-wrap gap-1">
            <Badge>{product.type.toLowerCase()}</Badge>
            {!product.active && <Badge className="bg-red-100 text-red-800">hidden</Badge>}
            <Badge>twin #{product.tokenId}</Badge>
          </div>
        </div>
      </div>
      <div className="flex items-end gap-2">
        <label className="w-24">
          <span className="text-xs text-ink-500">Price $</span>
          <input className={inputCls} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} aria-label={`Price of ${product.name}`} />
        </label>
        <label className="w-20">
          <span className="text-xs text-ink-500">Stock</span>
          <input className={inputCls} inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} aria-label={`Stock of ${product.name}`} />
        </label>
        <Button
          variant={dirty ? "primary" : "secondary"}
          disabled={!dirty}
          loading={saving}
          aria-label={`Save ${product.name}`}
          className="w-11 px-0"
          onClick={() => void save({ stock: Number.parseInt(stock, 10), priceCents: Math.round(Number.parseFloat(price) * 100) })}
        >
          {!saving && <Save className="size-4" aria-hidden />}
        </Button>
        <Button variant="ghost" onClick={() => void save({ active: !product.active })} disabled={saving}>
          {product.active ? "Hide" : "Show"}
        </Button>
      </div>
      {error && <div className="sm:w-full"><Notice tone="error">{error}</Notice></div>}
    </li>
  );
}

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function NewProductForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({ name: "", type: "PHYSICAL" as Product["type"], category: "general", price: "", stock: "10", imageUrl: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
          await api("/api/admin/products", {
            method: "POST",
            json: {
              name: form.name,
              slug: slugify(form.name),
              type: form.type,
              category: form.category,
              description: form.description,
              priceCents: Math.round(Number.parseFloat(form.price) * 100),
              stock: Number.parseInt(form.stock, 10),
              imageUrl: form.imageUrl,
            },
          });
          setForm((f) => ({ ...f, name: "", price: "", imageUrl: "", description: "" }));
          onCreated();
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setSaving(false);
        }
      }}
    >
      <Field label="Name">
        <input className={inputCls} required minLength={2} value={form.name} onChange={set("name")} />
      </Field>
      <Field label="Type">
        <select className={inputCls} value={form.type} onChange={set("type")}>
          {PRODUCT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.toLowerCase()}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Price (USD)">
        <input className={inputCls} required inputMode="decimal" value={form.price} onChange={set("price")} placeholder="49.00" />
      </Field>
      <Field label="Stock">
        <input className={inputCls} required inputMode="numeric" value={form.stock} onChange={set("stock")} />
      </Field>
      <Field label="Category">
        <input className={inputCls} value={form.category} onChange={set("category")} />
      </Field>
      <Field label="Image URL">
        <input className={inputCls} type="url" value={form.imageUrl} onChange={set("imageUrl")} placeholder="https://…" />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Description">
          <textarea className={inputCls} rows={2} value={form.description} onChange={set("description")} />
        </Field>
      </div>
      {error && <div className="sm:col-span-2"><Notice tone="error">{error}</Notice></div>}
      <Button type="submit" loading={saving} className="sm:col-span-2">
        <Plus className="size-4" aria-hidden /> Add product
      </Button>
    </form>
  );
}

export default function InventoryPage() {
  const { data, error, reload } = useApi<{ products: Product[] }>("/api/admin/products");
  const [showForm, setShowForm] = useState(false);
  const totalUnits = data?.products.filter((p) => p.type === "PHYSICAL").reduce((s, p) => s + p.stock, 0) ?? 0;
  const value = data?.products.filter((p) => p.type === "PHYSICAL").reduce((s, p) => s + p.stock * p.priceCents, 0) ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold">Inventory</h1>
        <Button variant="secondary" className="ml-auto" onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Close" : "New product"}
        </Button>
      </div>
      {data && (
        <p className="text-sm text-ink-500">
          {totalUnits} physical units in stock · {money(value)} retail value
        </p>
      )}
      {showForm && (
        <Card>
          <NewProductForm
            onCreated={() => {
              setShowForm(false);
              void reload();
            }}
          />
        </Card>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {!data && !error ? (
        <Spinner />
      ) : (
        <Card>
          <ul className="divide-y divide-ink-100">
            {data?.products.map((p) => <ProductRow key={`${p.id}-${p.stock}-${p.priceCents}-${p.active}`} product={p} onSaved={() => void reload()} />)}
          </ul>
        </Card>
      )}
    </div>
  );
}
