"use client";

import { Printer, QrCode } from "lucide-react";
import { useState } from "react";
import { MintStatusBadge } from "@/components/mint-status";
import { QrSvg } from "@/components/qr-svg";
import { Badge, Button, Card, Field, Notice, Spinner, inputCls } from "@/components/ui";
import { api, apiText, errorMessage } from "@/lib/api";
import { dateTime } from "@/lib/format";
import type { AdminPassport, PosSaleResult, Product, Store } from "@/lib/types";
import { useApi } from "@/lib/use-api";

function QrToggle({ code, serial }: { code: string; serial: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (svg) return <QrSvg svg={svg} label={`Pasaporte QR ${serial}`} className="size-28 bg-white" />;
  return (
    <div>
      <Button
        variant="ghost"
        onClick={() =>
          apiText(`/api/admin/passports/${code}/qr.svg`)
            .then(setSvg)
            .catch((e: unknown) => setError(errorMessage(e)))
        }
      >
        <QrCode className="size-4" aria-hidden /> QR
      </Button>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}

export default function PassportsPage() {
  const products = useApi<{ products: Product[] }>("/api/admin/products");
  const stores = useApi<{ stores: Store[] }>("/api/admin/stores");
  const list = useApi<{ passports: AdminPassport[] }>("/api/admin/passports");
  const [productId, setProductId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [quantity, setQuantity] = useState("5");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batch, setBatch] = useState<PosSaleResult["passports"] | null>(null);

  const physical = products.data?.products.filter((p) => p.type === "PHYSICAL") ?? [];
  const selectedProduct = productId || physical[0]?.id || "";

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await api<{ passports: PosSaleResult["passports"] }>("/api/admin/passports", {
        method: "POST",
        json: { productId: selectedProduct, quantity: Number.parseInt(quantity, 10), ...(storeId ? { storeId } : {}) },
      });
      setBatch(res.passports);
      void list.reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="no-print text-2xl font-bold">Pasaportes digitales QR</h1>
      <Card className="no-print">
        <p className="mb-3 text-sm text-ink-600">
          Generá etiquetas QR a prueba de falsificaciones para tu stock físico. Los clientes las escanean para verificar la autenticidad y reclamar un Gemelo Digital intransferible.
        </p>
        <div className="grid gap-3 sm:grid-cols-[2fr_1.5fr_1fr_auto] sm:items-end">
          <Field label="Producto">
            <select className={inputCls} value={selectedProduct} onChange={(e) => setProductId(e.target.value)}>
              {physical.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Local">
            <select className={inputCls} value={storeId} onChange={(e) => setStoreId(e.target.value)}>
              <option value="">Cualquiera / depósito</option>
              {stores.data?.stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cantidad">
            <input className={inputCls} type="number" min={1} max={200} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </Field>
          <Button loading={generating} disabled={!selectedProduct} onClick={() => void generate()}>
            Generar
          </Button>
        </div>
        {error && <div className="mt-3"><Notice tone="error">{error}</Notice></div>}
      </Card>

      {batch && (
        <div className="space-y-3">
          <div className="no-print flex items-center gap-2">
            <p className="text-sm font-semibold">{batch.length} pasaportes nuevos</p>
            <Button variant="secondary" className="ml-auto" onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden /> Imprimir
            </Button>
            <Button variant="ghost" onClick={() => setBatch(null)}>
              Listo
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {batch.map((p) => (
              <Card key={p.code} className="flex flex-col items-center text-center">
                <QrSvg svg={p.qrSvg} label={`Pasaporte QR ${p.serial}`} className="size-32 bg-white" />
                <p className="mt-2 font-mono text-xs">{p.serial}</p>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Card className="no-print">
        <h2 className="font-semibold">Pasaportes emitidos</h2>
        {list.error && <Notice tone="error">{list.error}</Notice>}
        {!list.data && !list.error ? (
          <Spinner />
        ) : list.data?.passports.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">Todavía no hay pasaportes.</p>
        ) : (
          <ul className="mt-2 divide-y divide-ink-100">
            {list.data?.passports.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{p.product.name}</p>
                  <p className="font-mono text-xs text-ink-500">
                    {p.serial} ·{" "}
                    <a href={p.url} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">
                      /p/{p.code}
                    </a>
                  </p>
                  <p className="text-xs text-ink-400">{dateTime(p.createdAt)}</p>
                </div>
                {p.claimedBy ? <Badge className="bg-emerald-100 text-emerald-800">Reclamado · {p.claimedBy.email}</Badge> : <Badge>Sin reclamar</Badge>}
                {p.mint && <MintStatusBadge status={p.mint.status} />}
                <QrToggle code={p.code} serial={p.serial} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
