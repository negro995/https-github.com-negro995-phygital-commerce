import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  variant = "primary",
  loading,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  const styles: Record<Variant, string> = {
    primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm",
    secondary: "bg-white text-ink-900 ring-1 ring-ink-200 hover:bg-ink-50",
    ghost: "text-ink-700 hover:bg-ink-100",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-60",
        styles[variant],
        className,
      )}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

const NOTICE = {
  info: { icon: Info, cls: "bg-sky-50 text-sky-900 ring-sky-200" },
  success: { icon: CheckCircle2, cls: "bg-emerald-50 text-emerald-900 ring-emerald-200" },
  warning: { icon: AlertTriangle, cls: "bg-amber-50 text-amber-900 ring-amber-200" },
  error: { icon: XCircle, cls: "bg-red-50 text-red-900 ring-red-200" },
} as const;

export function Notice({
  tone = "info",
  title,
  children,
  action,
}: {
  tone?: keyof typeof NOTICE;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const { icon: Icon, cls } = NOTICE[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("flex gap-3 rounded-xl p-3 text-sm ring-1", cls)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cx(title && "mt-0.5", "break-words")}>{children}</div>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-ink-500" role="status">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      {label}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-xl bg-ink-100", className)} aria-hidden />;
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", className ?? "bg-ink-100 text-ink-700")}>
      {children}
    </span>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-100 sm:p-5", className)}>{children}</div>;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-200 p-8 text-center">
      <p className="font-semibold text-ink-900">{title}</p>
      {children && <div className="mt-2 text-sm text-ink-500">{children}</div>}
    </div>
  );
}

export const inputCls =
  "block w-full min-h-11 rounded-xl border-0 bg-white px-3 py-2 text-sm text-ink-900 ring-1 ring-ink-200 placeholder:text-ink-400 focus:ring-2 focus:ring-brand-500 focus:outline-none";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-500">{hint}</span>}
    </label>
  );
}
