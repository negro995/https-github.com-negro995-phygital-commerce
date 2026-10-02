"use client";

import { MINT_STATUSES, type MintStatus } from "@phygital/shared";
import { RotateCw } from "lucide-react";
import { useState } from "react";
import { MintStatusBadge, TxLink } from "@/components/mint-status";
import { Badge, Button, Card, Notice, Spinner, cx } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useConfig } from "@/lib/config";
import { MINT_STATUS_LABELS, dateTime, shortAddress } from "@/lib/format";
import type { AdminMint } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export default function MintsPage() {
  const [filter, setFilter] = useState<MintStatus | "">("");
  const { data, error, reload } = useApi<{ mints: AdminMint[] }>(`/api/admin/mints${filter ? `?status=${filter}` : ""}`, { refreshMs: 5_000 });
  const { config } = useConfig();
  const [retrying, setRetrying] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const retry = async (id: string) => {
    setRetrying(id);
    setActionError(null);
    try {
      await api(`/api/admin/mints/${id}/retry`, { method: "POST" });
      await reload();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setRetrying(null);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Cola de emisión de Gemelos Digitales</h1>
      {config && !config.web3.minting && (
        <Notice tone="warning" title="La emisión en blockchain no está configurada">
          Las emisiones quedan en cola de forma segura y se procesan automáticamente cuando configures RPC_URL, TWIN_CONTRACT_ADDRESS y MINTER_PRIVATE_KEY en la API.
        </Notice>
      )}
      <div className="flex gap-2 overflow-x-auto">
        {(["", ...MINT_STATUSES] as const).map((s) => (
          <button
            key={s || "all"}
            onClick={() => setFilter(s)}
            className={cx("min-h-10 shrink-0 rounded-full px-4 text-sm font-medium ring-1", filter === s ? "bg-ink-900 text-white ring-ink-900" : "bg-white ring-ink-200")}
          >
            {s ? MINT_STATUS_LABELS[s] : "Todas"}
          </button>
        ))}
      </div>
      {(error || actionError) && <Notice tone="error">{error ?? actionError}</Notice>}
      {!data && !error ? (
        <Spinner />
      ) : (
        <Card>
          {data?.mints.length === 0 ? (
            <p className="text-sm text-ink-500">No hay nada acá.</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {data?.mints.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{m.product.name}</p>
                    <p className="text-xs text-ink-500">
                      {m.user.email} · {shortAddress(m.walletAddress)} · {dateTime(m.createdAt)}
                    </p>
                    {m.lastError && <p className="mt-0.5 line-clamp-2 text-xs text-red-700">{m.lastError}</p>}
                  </div>
                  <Badge>{m.source === "ORDER" ? "pedido" : "reclamo QR"}</Badge>
                  <MintStatusBadge status={m.status} attempts={m.attempts} />
                  <TxLink txHash={m.txHash} explorerUrl={m.explorerUrl} />
                  {(m.status === "FAILED" || (m.status === "PENDING" && m.attempts > 0)) && (
                    <Button variant="secondary" loading={retrying === m.id} onClick={() => void retry(m.id)}>
                      <RotateCw className="size-4" aria-hidden /> Reintentar
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
