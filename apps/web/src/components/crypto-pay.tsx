"use client";

import { Wallet } from "lucide-react";
import { useState } from "react";
import { apiRequest, errorMessage } from "@/lib/api";
import { hasInjectedWallet, payWithInjectedWallet, walletErrorMessage } from "@/lib/crypto-pay";
import { shortAddress } from "@/lib/format";
import { Button, Field, Notice, inputCls } from "./ui";

export interface CryptoPayProps {
  orderId: string;
  chainId: number;
  token: string;
  recipient: string;
  /** Token base units (6 decimals). */
  amount: string;
  onPaid: () => void;
}

const TX_HASH_RE = /^0x[a-fA-F0-9]{64}$/;

type Phase = { kind: "idle" } | { kind: "wallet" } | { kind: "verifying"; txHash: string } | { kind: "pending"; txHash: string; message: string } | { kind: "error"; message: string; txHash?: string };

export function CryptoPay({ orderId, chainId, token, recipient, amount, onPaid }: CryptoPayProps) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [manualHash, setManualHash] = useState("");
  const display = (Number(BigInt(amount)) / 1e6).toFixed(2);

  const verify = async (txHash: string, attempt = 0): Promise<void> => {
    setPhase({ kind: "verifying", txHash });
    try {
      const res = await apiRequest<{ status: "paid" | "pending"; message?: string }>(`/api/orders/${orderId}/crypto-confirm`, {
        method: "POST",
        json: { txHash },
      });
      if (res.data.status === "paid") return onPaid();
      setPhase({ kind: "pending", txHash, message: res.data.message ?? "Esperando confirmaciones…" });
      if (attempt < 40) {
        await new Promise((r) => setTimeout(r, 4_000));
        return verify(txHash, attempt + 1);
      }
      setPhase({ kind: "error", txHash, message: "Todavía no está confirmado. Tu pago está seguro: volvé a verificar en unos minutos." });
    } catch (err) {
      setPhase({ kind: "error", txHash, message: errorMessage(err) });
    }
  };

  const payWithWallet = async () => {
    setPhase({ kind: "wallet" });
    try {
      const txHash = await payWithInjectedWallet({ chainId, token, recipient, amount });
      await verify(txHash);
    } catch (err) {
      setPhase({ kind: "error", message: walletErrorMessage(err) });
    }
  };

  const hashValid = TX_HASH_RE.test(manualHash.trim());
  const hashInvalid = manualHash.trim() !== "" && !hashValid;
  const busy = phase.kind === "wallet" || phase.kind === "verifying" || phase.kind === "pending";

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-ink-50 p-4 text-sm">
        <p className="text-2xl font-bold text-ink-900">{display} USDC</p>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-ink-600">
          <dt>Red</dt>
          <dd>Chain ID {chainId}</dd>
          <dt>Enviar a</dt>
          <dd className="break-all font-mono">{recipient}</dd>
          <dt>Token</dt>
          <dd className="font-mono">{shortAddress(token)}</dd>
        </dl>
      </div>

      <Button className="w-full" onClick={() => void payWithWallet()} loading={phase.kind === "wallet"} disabled={busy || !hasInjectedWallet()}>
        <Wallet className="size-4" aria-hidden /> {hasInjectedWallet() ? "Pagar con la wallet del navegador" : "No detectamos una wallet en el navegador"}
      </Button>

      {phase.kind === "wallet" && <Notice>Confirmá la transferencia en tu wallet…</Notice>}
      {phase.kind === "verifying" && <Notice>Verificando tu transacción en blockchain…</Notice>}
      {phase.kind === "pending" && <Notice tone="warning" title="Transacción detectada, esperando confirmaciones">{phase.message}</Notice>}
      {phase.kind === "error" && (
        <Notice
          tone="error"
          title="El pago todavía no está confirmado"
          action={
            phase.txHash ? (
              <Button variant="secondary" onClick={() => void verify(phase.txHash!)}>
                Verificar de nuevo
              </Button>
            ) : undefined
          }
        >
          {phase.message}
        </Notice>
      )}

      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          void verify(manualHash.trim());
        }}
      >
        <Field label="¿Ya pagaste desde otra wallet?" hint="Pegá el hash de la transacción y lo verificamos.">
          <input
            className={`${inputCls} font-mono`}
            placeholder="0x…"
            value={manualHash}
            onChange={(e) => setManualHash(e.target.value)}
            pattern="^0x[a-fA-F0-9]{64}$"
            aria-invalid={hashInvalid}
            aria-describedby={hashInvalid ? "tx-hash-error" : undefined}
          />
        </Field>
        {hashInvalid && (
          <p id="tx-hash-error" className="text-xs text-red-700">
            El hash debe empezar con 0x y tener 64 caracteres hexadecimales (0-9, a-f).
          </p>
        )}
        <Button type="submit" variant="secondary" className="w-full" disabled={busy || !hashValid}>
          Verificar transacción
        </Button>
      </form>
    </div>
  );
}
