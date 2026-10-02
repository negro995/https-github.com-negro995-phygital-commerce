"use client";

import { useCallback, useState, type ReactNode } from "react";
import { SignInDialog } from "@/components/sign-in-dialog";
import { AuthContextProvider, useAuthCore } from "./auth";

export const DEMO_EMAIL_KEY = "phygital.demoEmail";

/** Local development sign-in: the API trusts the `x-demo-email` header when AUTH_MODE=dev. */
export function DevAuthProvider({ children }: { children: ReactNode }) {
  // Rendered client-side only (dynamic import with ssr: false), so localStorage is available.
  const [email, setEmail] = useState<string | null>(() => localStorage.getItem(DEMO_EMAIL_KEY));
  const [dialogOpen, setDialogOpen] = useState(false);

  const headers = useCallback(async (): Promise<Record<string, string>> => (email ? { "x-demo-email": email } : {}), [email]);
  const signIn = useCallback(() => setDialogOpen(true), []);
  const signOut = useCallback(async () => {
    localStorage.removeItem(DEMO_EMAIL_KEY);
    setEmail(null);
  }, []);

  const value = useAuthCore({ mode: "dev", ready: true, signedIn: Boolean(email), identityKey: email, headers, signIn, signOut });

  return (
    <AuthContextProvider value={value}>
      {children}
      <SignInDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={(next) => {
          const normalized = next.trim().toLowerCase();
          localStorage.setItem(DEMO_EMAIL_KEY, normalized);
          setEmail(normalized);
          setDialogOpen(false);
        }}
      />
    </AuthContextProvider>
  );
}
