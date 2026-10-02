"use client";

import { Boxes, Fingerprint, LayoutDashboard, QrCode, Store } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Button, EmptyState, Notice, Spinner, cx } from "@/components/ui";
import { useAuth } from "@/lib/auth";

const NAV = [
  { href: "/admin", label: "Resumen", icon: LayoutDashboard },
  { href: "/admin/inventory", label: "Inventario", icon: Boxes },
  { href: "/admin/pos", label: "Venta en local", icon: Store },
  { href: "/admin/passports", label: "Pasaportes QR", icon: QrCode },
  { href: "/admin/mints", label: "Cola de emisión", icon: Fingerprint },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { ready, signedIn, signIn, me, meError } = useAuth();
  const pathname = usePathname();

  if (!ready || (signedIn && !me && !meError)) return <Spinner />;
  if (!signedIn) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <EmptyState title="Ingreso para comercios">
          <Button className="mt-2" onClick={signIn}>
            Ingresar
          </Button>
        </EmptyState>
      </div>
    );
  }
  if (meError) return <div className="mx-auto max-w-md px-4 py-16"><Notice tone="error">{meError}</Notice></div>;
  if (me && me.user.role === "CUSTOMER") {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <Notice tone="warning" title="Solo para administradores">Tu cuenta ({me.user.email}) no tiene acceso al panel del comercio.</Notice>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-4 md:grid md:grid-cols-[200px_1fr] md:gap-8 md:py-8">
      <nav className="no-print -mx-4 mb-4 flex gap-1 overflow-x-auto border-b border-ink-100 px-4 pb-2 md:mx-0 md:flex-col md:border-0 md:px-0" aria-label="Panel del comercio">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cx(
                "flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-medium",
                active ? "bg-brand-600 text-white" : "text-ink-700 hover:bg-ink-100",
              )}
            >
              <Icon className="size-4" aria-hidden /> {label}
            </Link>
          );
        })}
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
