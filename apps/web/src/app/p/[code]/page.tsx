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

  if (loading && !data) return <Spinner label="Verifying passport…" />;
  if (error && !data) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <Notice tone="error" title="Passport not recognised">
          {error}. This QR code may be counterfeit — ask the store staff for help.
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
            <BadgeCheck className="size-4" aria-hidden /> Authentic product
          </p>
          <h1 className="text-xl font-bold">{passport.product.name}</h1>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-ink-500">Serial</dt>
            <dd className="font-mono">{passport.serial}</dd>
            {passport.store && (
              <>
                <dt className="text-ink-500">Sold at</dt>
                <dd className="flex items-center gap-1">
                  <MapPin className="size-3.5" aria-hidden /> {passport.store.name}
                  {passport.store.city && `, ${passport.store.city}`}
                </dd>
              </>
            )}
            <dt className="text-ink-500">Twin token</dt>
            <dd>#{passport.product.tokenId}</dd>
          </dl>
        </div>
      </Card>

      <Card className="space-y-3">
        {passport.claimedByViewer ? (
          <>
            <p className="font-semibold">You own this product&apos;s Digital Twin</p>
            {passport.mint && (
              <div className="flex items-center gap-2">
                <MintStatusBadge status={passport.mint.status} />
                <TxLink txHash={passport.mint.txHash} explorerUrl={passport.mint.explorerUrl} />
              </div>
            )}
            {passport.mint?.status !== "CONFIRMED" && (
              <p className="text-sm text-ink-500">Minting happens in the background. It&apos;s safe to close this page.</p>
            )}
          </>
        ) : passport.claimed ? (
          <Notice tone="warning" title="Already claimed">This product&apos;s Digital Twin belongs to another owner.</Notice>
        ) : (
          <>
            <p className="font-semibold">Claim your Digital Twin</p>
            <p className="text-sm text-ink-600">
              Bought this in store? Claim it to mint a soulbound Digital Twin to your wallet and level up your loyalty tier.
            </p>
            {claimError && <Notice tone="error">{claimError}</Notice>}
            {signedIn ? (
              <Button className="w-full" loading={claiming} onClick={() => void claim()}>
                Claim Digital Twin
              </Button>
            ) : (
              <Button className="w-full" onClick={signIn}>
                Sign in to claim
              </Button>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
