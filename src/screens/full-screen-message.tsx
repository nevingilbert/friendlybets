import Link from "next/link";

import { TopBar } from "@/components/top-bar";
import { Alert } from "@/components/ui";

/** The "you can't see this" page every lobby route falls back to. */
export function FullScreenMessage({
  title,
  message,
  backTo = "/",
  backLabel = "Back to your lobbies",
}: {
  title: string;
  message: string;
  backTo?: string;
  backLabel?: string;
}) {
  return (
    <div className="min-h-screen bg-zinc-950">
      <TopBar title={title} backTo={backTo} />
      <div className="mx-auto flex max-w-md flex-col gap-4 px-4 py-10">
        <Alert>{message}</Alert>
        <Link
          href={backTo}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-800 px-4 text-sm font-semibold text-zinc-100 ring-1 ring-zinc-700 hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
        >
          {backLabel}
        </Link>
      </div>
    </div>
  );
}
