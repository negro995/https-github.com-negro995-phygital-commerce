"use client";

import { BadgeCheck, MapPin } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { MintStatusBadge, TxLink } from "@/components/mint-status";
import { ProductImage } from "@/components/product-card";
import { Button, Card, Notice, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Passport } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export default function PassportPage() {
  const { code } = useParams<{ code: string }>();
  const { signedIn, signIn, me, refreshMe } = useAuth();
  const { data, error, loading, reload } = useApi<{ passport: Passport }>(`/api/passports/${encodeURIComponent(code)}`, {
    deps: [me?.user.id],
    refreshMs: 5_000,
  });
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  if (loading && !data) return <Spinner label="Verificando pasaporte…" />;
  if (error && !data) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <Notice tone="error" title="Pasaporte no reconocido">
          {error}. Este código QR podría ser falso: pedile ayuda al personal de la tienda.
        </Notice>
      </div>
    );
  }
  if (!data) return null;
  const { passport } = data;

  const claim = async () => {
    setClaiming(true);
    setClaimError(null);
    try {
      await api(`/api/passports/${encodeURIComponent(code)}/claim`, { method: "POST" });
      await Promise.all([reload(), refreshMe()]);
    } catch (err) {
      setClaimError(errorMessage(err));
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
      <Card className="overflow-hidden p-0 sm:p-0">
        <ProductImage src={passport.product.imageUrl} alt={passport.product.name} className="aspect-video w-full object-cover" />
        <div className="space-y-3 p-5">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
            <BadgeCheck className="size-4" aria-hidden /> Producto auténtico
          </p>
          <h1 className="text-xl font-bold">{passport.product.name}</h1>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-ink-500">N.º de serie</dt>
            <dd className="font-mono">{passport.serial}</dd>
            {passport.store && (
              <>
                <dt className="text-ink-500">Vendido en</dt>
                <dd className="flex items-center gap-1">
                  <MapPin className="size-3.5" aria-hidden /> {passport.store.name}
                  {passport.store.city && `, ${passport.store.city}`}
                </dd>
              </>
            )}
            <dt className="text-ink-500">Token del gemelo</dt>
            <dd>#{passport.product.tokenId}</dd>
          </dl>
        </div>
      </Card>

      <Card className="space-y-3">
        {passport.claimedByViewer ? (
          <>
            <p className="font-semibold">Sos dueño del Gemelo Digital de este producto</p>
            {passport.mint && (
              <div className="flex items-center gap-2">
                <MintStatusBadge status={passport.mint.status} />
                <TxLink txHash={passport.mint.txHash} explorerUrl={passport.mint.explorerUrl} />
              </div>
            )}
            {passport.mint?.status !== "CONFIRMED" && (
              <p className="text-sm text-ink-500">La emisión ocurre en segundo plano. Podés cerrar esta página tranquilo.</p>
            )}
          </>
        ) : passport.claimed ? (
          <Notice tone="warning" title="Ya fue reclamado">El Gemelo Digital de este producto pertenece a otra persona.</Notice>
        ) : (
          <>
            <p className="font-semibold">Reclamá tu Gemelo Digital</p>
            <p className="text-sm text-ink-600">
              ¿Lo compraste en el local? Reclamalo para emitir un Gemelo Digital intransferible a tu wallet y subir tu nivel de fidelidad.
            </p>
            {claimError && <Notice tone="error">{claimError}</Notice>}
            {signedIn ? (
              <Button className="w-full" loading={claiming} onClick={() => void claim()}>
                Reclamar Gemelo Digital
              </Button>
            ) : (
              <Button className="w-full" onClick={signIn}>
                Ingresá para reclamarlo
              </Button>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
