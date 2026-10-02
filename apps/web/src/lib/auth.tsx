"use client";

import dynamic from "next/dynamic";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, setAuthHeaderSource, type AuthHeaders } from "./api";
import type { Me } from "./types";

export interface AuthContextValue {
  mode: "dev" | "privy";
  ready: boolean;
  signedIn: boolean;
  me: Me | null;
  meError: string | null;
  signIn: () => void;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

/** Shared logic for both auth modes: wires request headers and loads `/api/me`. */
export function useAuthCore(opts: {
  mode: "dev" | "privy";
  ready: boolean;
  signedIn: boolean;
  identityKey: string | null;
  headers: AuthHeaders;
  signIn: () => void;
  signOut: () => Promise<void>;
}): AuthContextValue {
  const { mode, ready, signedIn, identityKey, headers, signIn, signOut } = opts;
  const [me, setMe] = useState<Me | null>(null);
  const [meError, setMeError] = useState<string | null>(null);

  useEffect(() => {
    setAuthHeaderSource(headers);
  }, [headers]);

  const refreshMe = useCallback((): Promise<void> => {
    if (!signedIn) return Promise.resolve();
    setAuthHeaderSource(headers);
    return api<Me>("/api/me").then(
      (next) => {
        setMe(next);
        setMeError(null);
      },
      (err: unknown) => setMeError(err instanceof Error ? err.message : "No pudimos cargar tu cuenta"),
    );
  }, [signedIn, headers]);

  useEffect(() => {
    if (ready) void refreshMe();
  }, [ready, identityKey, refreshMe]);

  const currentMe = signedIn ? me : null;
  const currentError = signedIn ? meError : null;
  return useMemo(
    () => ({ mode, ready, signedIn, me: currentMe, meError: currentError, signIn, signOut, refreshMe }),
    [mode, ready, signedIn, currentMe, currentError, signIn, signOut, refreshMe],
  );
}

export function AuthContextProvider({ value, children }: { value: AuthContextValue; children: ReactNode }) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

const PrivyAuthProvider = dynamic(() => import("./privy-auth").then((m) => m.PrivyAuthProvider), { ssr: false });
const DevAuthProvider = dynamic(() => import("./dev-auth").then((m) => m.DevAuthProvider), { ssr: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  return PRIVY_APP_ID ? (
    <PrivyAuthProvider appId={PRIVY_APP_ID}>{children}</PrivyAuthProvider>
  ) : (
    <DevAuthProvider>{children}</DevAuthProvider>
  );
}
