"use client";

import { useState } from "react";
import { Button, Field, inputCls } from "./ui";

export function SignInDialog({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (email: string) => void }) {
  const [email, setEmail] = useState("");
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal aria-labelledby="signin-title">
      <form
        className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-3xl"
        onSubmit={(e) => {
          e.preventDefault();
          if (email.includes("@")) onSubmit(email);
        }}
      >
        <h2 id="signin-title" className="text-lg font-bold text-ink-900">
          Sign in
        </h2>
        <p className="mt-1 text-sm text-ink-500">
          Demo mode: enter any email. A wallet is created for you automatically on your first purchase — no seed phrase needed.
        </p>
        <div className="mt-4">
          <Field label="Email" hint="Use admin@phygital.dev to open the store manager dashboard.">
            <input
              autoFocus
              type="email"
              required
              className={inputCls}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </Field>
        </div>
        <div className="mt-6 flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1">
            Continue
          </Button>
        </div>
      </form>
    </div>
  );
}
