import type { MintStatus } from "@phygital/shared";
import { CheckCircle2, Clock, ExternalLink, Loader2, XCircle } from "lucide-react";
import { Badge } from "./ui";

const LABELS: Record<MintStatus, { label: string; cls: string; icon: typeof Clock }> = {
  PENDING: { label: "Queued", cls: "bg-ink-100 text-ink-700", icon: Clock },
  SUBMITTED: { label: "Minting…", cls: "bg-sky-100 text-sky-800", icon: Loader2 },
  CONFIRMED: { label: "Minted", cls: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 },
  FAILED: { label: "Needs attention", cls: "bg-red-100 text-red-800", icon: XCircle },
  SKIPPED: { label: "Skipped", cls: "bg-ink-100 text-ink-500", icon: Clock },
};

export function MintStatusBadge({ status, attempts = 0 }: { status: MintStatus; attempts?: number }) {
  const { label, cls, icon: Icon } = LABELS[status];
  const retrying = status === "PENDING" && attempts > 0;
  return (
    <Badge className={retrying ? "bg-amber-100 text-amber-800" : cls}>
      <Icon className={status === "SUBMITTED" ? "size-3 animate-spin" : "size-3"} aria-hidden />
      {retrying ? `Retrying (attempt ${attempts + 1})` : label}
    </Badge>
  );
}

export function TxLink({ txHash, explorerUrl }: { txHash: string | null; explorerUrl: string | null }) {
  if (!txHash) return null;
  const short = `${txHash.slice(0, 10)}…`;
  return explorerUrl ? (
    <a href={explorerUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-brand-700 hover:underline">
      {short} <ExternalLink className="size-3" aria-hidden />
    </a>
  ) : (
    <span className="font-mono text-xs text-ink-500" title={txHash}>
      {short}
    </span>
  );
}
