"use client";

import { LayoutDashboard, LogOut, ShoppingBag, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { Button, cx } from "./ui";

export function Header() {
  const { signedIn, me, signIn, signOut, ready } = useAuth();
  const { count } = useCart();
  const pathname = usePathname();
  const isManager = me?.user.role === "ADMIN" || me?.user.role === "STAFF";

  return (
    <header className="sticky top-0 z-30 border-b border-ink-100 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:h-16">
        <Link href="/" className="flex items-center gap-2 font-bold text-ink-900">
          <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-brand-600 to-fuchsia-600 text-white">✦</span>
          <span className="hidden sm:inline">Lazo</span>
        </Link>
        <nav className="ml-auto flex items-center gap-1">
          {isManager && (
            <Link
              href="/admin"
              className={cx("flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-medium hover:bg-ink-100", pathname.startsWith("/admin") && "text-brand-700")}
            >
              <LayoutDashboard className="size-5" aria-hidden />
              <span className="hidden sm:inline">Manager</span>
            </Link>
          )}
          {ready && signedIn ? (
            <>
              <Link href="/account" className="flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-medium hover:bg-ink-100">
                <User className="size-5" aria-hidden />
                <span className="hidden max-w-32 truncate sm:inline">{me?.loyalty.tier.name ?? "Account"}</span>
              </Link>
              <button onClick={() => void signOut()} className="grid size-11 place-items-center rounded-xl hover:bg-ink-100" aria-label="Sign out">
                <LogOut className="size-5" aria-hidden />
              </button>
            </>
          ) : (
            <Button variant="ghost" onClick={signIn} disabled={!ready}>
              Sign in
            </Button>
          )}
          <Link href="/cart" className="relative grid size-11 place-items-center rounded-xl hover:bg-ink-100" aria-label={`Cart, ${count} items`}>
            <ShoppingBag className="size-5" aria-hidden />
            {count > 0 && (
              <span className="absolute right-1 top-1 grid min-w-5 place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">{count}</span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  );
}
