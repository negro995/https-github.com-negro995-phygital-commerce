import { Crown, Lock, Sparkles } from "lucide-react";
import type { LoyaltyStatus } from "@/lib/types";
import { shortAddress } from "@/lib/format";
import { Card, cx } from "./ui";

export function LoyaltyCard({ loyalty }: { loyalty: LoyaltyStatus }) {
  const { tier, next, twinCount } = loyalty;
  const progress = next ? Math.min(100, Math.round((twinCount / next.tier.minTwins) * 100)) : 100;
  return (
    <Card className="overflow-hidden p-0 sm:p-0">
      <div className="bg-gradient-to-br from-brand-600 via-brand-700 to-fuchsia-700 p-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-white/70">Nivel de fidelidad</p>
            <p className="mt-1 flex items-center gap-2 text-2xl font-bold">
              <Crown className="size-6" aria-hidden /> {tier.name}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">{twinCount}</p>
            <p className="text-xs text-white/70">Gemelos Digitales</p>
          </div>
        </div>
        <p className="mt-3 text-sm">
          {tier.discountBps > 0 ? `${tier.discountBps / 100}% de descuento aplicado automáticamente al pagar` : "Conseguí tu primer Gemelo Digital para desbloquear descuentos"}
        </p>
        <div className="mt-4">
          <div className="h-2 rounded-full bg-white/20" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-2 rounded-full bg-white" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-white/80">
            {next ? `Te faltan ${next.twinsNeeded} para llegar a ${next.tier.name} (${next.tier.discountBps / 100}% de descuento)` : "Llegaste al nivel máximo, ¡gracias!"}
          </p>
        </div>
      </div>
      <div className="p-5">
        <p className="text-sm font-semibold text-ink-900">Beneficios exclusivos</p>
        <ul className="mt-2 space-y-1.5">
          {loyalty.perks.map((p) => (
            <li key={`${p.tierId}-${p.perk}`} className={cx("flex items-center gap-2 text-sm", p.unlocked ? "text-ink-800" : "text-ink-400")}>
              {p.unlocked ? <Sparkles className="size-4 text-brand-600" aria-hidden /> : <Lock className="size-4" aria-hidden />}
              <span>{p.perk}</span>
              <span className="ml-auto text-xs">{p.tierName}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-ink-500">
          Wallet {shortAddress(loyalty.walletAddress)} ·{" "}
          {loyalty.source === "onchain" ? "verificado en blockchain" : "según registros de la tienda (blockchain no disponible por el momento)"}
        </p>
      </div>
    </Card>
  );
}
