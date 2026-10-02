"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/lib/auth";
import { CartProvider } from "@/lib/cart";
import { ConfigProvider } from "@/lib/config";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider>
      <AuthProvider>
        <CartProvider>{children}</CartProvider>
      </AuthProvider>
    </ConfigProvider>
  );
}
