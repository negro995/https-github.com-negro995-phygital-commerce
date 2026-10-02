"use client";

import { Button, Notice } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Notice tone="error" title="Algo salió mal" action={<Button onClick={reset}>Reintentar</Button>}>
        {error.message || "Ocurrió un error inesperado."}
      </Notice>
    </div>
  );
}
