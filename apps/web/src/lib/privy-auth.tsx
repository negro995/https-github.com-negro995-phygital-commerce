"use client";

import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { useCallback, type ReactNode } from "react";
import { AuthContextProvider, useAuthCore } from "./auth";

function PrivyBridge({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, login, logout, getAccessToken } = usePrivy();

  const headers = useCallback(async (): Promise<Record<string, string>> => {
    if (!authenticated) return {};
    const token = await getAccessToken();
    return token ? { authorization: `Bearer ${token}` } : {};
  }, [authenticated, getAccessToken]);
  const signIn = useCallback(() => login(), [login]);

  const value = useAuthCore({
    mode: "privy",
    ready,
    signedIn: ready && authenticated,
    identityKey: user?.id ?? null,
    headers,
    signIn,
    signOut: logout,
  });
  return <AuthContextProvider value={value}>{children}</AuthContextProvider>;
}

/** Social login (email / Google / Apple) with an embedded wallet created automatically on first login. */
export function PrivyAuthProvider({ appId, children }: { appId: string; children: ReactNode }) {
  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["email", "google", "apple"],
        appearance: { theme: "light", accentColor: "#4f46e5" },
        embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } },
      }}
    >
      <PrivyBridge>{children}</PrivyBridge>
    </PrivyProvider>
  );
}
