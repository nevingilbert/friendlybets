"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { SignInButton } from "@/components/sign-in-button";
import { Alert, Card, Spinner } from "@/components/ui";
import type { LobbyPreview } from "@/lib/types";
import { joinLobbyAction } from "@/server/actions";

/**
 * Landing page for an invite link (/join/XK4P2M).
 *
 * Readable signed-out, so the invitee sees who invited them *before* being asked to
 * sign in. Google returns them to this exact URL, and the join then happens without
 * another tap.
 */
export function JoinLobby({ preview, signedIn }: { preview: LobbyPreview; signedIn: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const attempted = useRef(false);

  useEffect(() => {
    if (!signedIn || attempted.current) return;
    attempted.current = true;
    joinLobbyAction(preview.code).then((result) => {
      if (result.ok) router.replace(`/lobby/${result.data.id}`);
      else setError(result.error);
    });
  }, [signedIn, preview.code, router]);

  if (error) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-6 py-16">
        <h1 className="text-2xl font-bold text-zinc-100">That invite didn&apos;t work</h1>
        <Alert>{error}</Alert>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-800 px-4 text-sm font-semibold text-zinc-100 ring-1 ring-zinc-700 hover:bg-zinc-700"
        >
          Go to FriendlyBets
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-6 py-16">
      <div className="animate-fade-up text-center">
        <p className="mb-2 text-sm font-semibold tracking-widest text-emerald-400 uppercase">You&apos;re invited</p>
        <p className="text-zinc-400">
          <span className="font-semibold text-zinc-200">{preview.host_name}</span> invited you to
        </p>
        <h1 className="mt-2 text-3xl leading-tight font-extrabold text-balance text-zinc-50">{preview.name}</h1>
      </div>

      <Card className="animate-fade-up flex items-center justify-between px-5 py-4">
        <div>
          <p className="text-xs tracking-wide text-zinc-500 uppercase">Join code</p>
          <p className="font-mono text-xl tracking-[0.3em] text-emerald-300">{preview.code}</p>
        </div>
        <div className="text-right">
          <p className="text-xs tracking-wide text-zinc-500 uppercase">Players</p>
          <p className="text-xl font-bold text-zinc-100 tabular-nums">{preview.member_count}</p>
        </div>
      </Card>

      {signedIn ? (
        <div className="flex items-center justify-center gap-3 text-sm text-zinc-400">
          <Spinner className="h-5 w-5" /> Joining…
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {preview.status !== "OPEN" && (
            <Alert tone="info">
              {preview.host_name} has closed this lobby to new players. If you were already in it, signing in will
              still let you back.
            </Alert>
          )}
          {/* Shown even for a closed lobby: join_lobby readmits an existing member
              before it checks the lobby status. */}
          <SignInButton label="Sign in with Google to join" redirectTo={`/join/${preview.code}`} />
        </div>
      )}
    </main>
  );
}
