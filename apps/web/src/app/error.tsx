"use client";

import { Button, Notice } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Notice tone="error" title="Something went wrong" action={<Button onClick={reset}>Try again</Button>}>
        {error.message || "An unexpected error occurred."}
      </Notice>
    </div>
  );
}
