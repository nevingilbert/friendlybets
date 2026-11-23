"use client";

import { Button } from "@/components/ui";

/** Shown when a page could not load — almost always the database being unreachable. */
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-2xl font-bold text-zinc-50">That didn&apos;t load</h1>
      <p className="text-zinc-400">The server could not reach the database. It may be waking up — try again in a few seconds.</p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
