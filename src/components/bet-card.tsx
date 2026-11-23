"use client";

import Link from "next/link";

import { Card, SidePill, StatusPill } from "@/components/ui";
import type { NameOf } from "@/hooks/use-lobby-data";
import { oppositeOf } from "@/lib/bets";
import { formatRelative } from "@/lib/format";
import type { Bet } from "@/lib/types";

export function BetCard({
  bet,
  currentUserId,
  nameOf,
  lobbyId,
  now,
  onAccept,
  accepting,
}: {
  bet: Bet;
  currentUserId: string;
  nameOf: NameOf;
  lobbyId: string;
  now: number;
  onAccept: (betId: string) => void;
  accepting: boolean;
}) {
  const isCreator = bet.creator_id === currentUserId;
  const isAcceptor = bet.acceptor_id === currentUserId;
  const canAccept = bet.status === "OPEN" && !isCreator;
  const yourSide = isCreator ? bet.creator_side : isAcceptor ? oppositeOf(bet.creator_side) : null;

  return (
    <Card className="animate-fade-up relative p-4 transition-colors hover:border-zinc-700 hover:bg-zinc-900">
      <div className="mb-3 flex items-start justify-between gap-3">
        <StatusPill status={bet.status} />
        <span className="shrink-0 text-xs text-zinc-500">{formatRelative(bet.created_at, now)}</span>
      </div>

      {/* The whole card is the link; the accept button below sits above it. */}
      <Link
        href={`/lobby/${lobbyId}/bet/${bet.id}`}
        className="text-base leading-snug font-medium text-balance text-zinc-100 after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-emerald-400"
      >
        {bet.proposition}
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-lg bg-violet-500/15 px-2.5 py-1 font-semibold text-violet-300 ring-1 ring-violet-500/25 ring-inset">
          {bet.stake}
        </span>
        {yourSide && (
          <span className="text-xs text-zinc-500">
            you&apos;re on <SidePill side={yourSide} />
          </span>
        )}
      </div>

      <p className="mt-3 text-sm text-zinc-500">
        <span className="font-medium text-zinc-300">{isCreator ? "You" : nameOf(bet.creator_id)}</span> said{" "}
        <SidePill side={bet.creator_side} />
        {bet.acceptor_id && (
          <>
            {" · "}
            <span className="font-medium text-zinc-300">{isAcceptor ? "you" : nameOf(bet.acceptor_id)}</span> took{" "}
            <SidePill side={oppositeOf(bet.creator_side)} />
          </>
        )}
      </p>

      {(bet.status === "RESOLVED" || bet.status === "COMPLETED") && bet.winner_id && (
        <p className="mt-3 border-t border-zinc-800 pt-3 text-sm text-zinc-400">
          <span className="font-semibold text-emerald-400">
            {bet.winner_id === currentUserId ? "You" : nameOf(bet.winner_id)}
          </span>{" "}
          won ·{" "}
          <span className="font-semibold text-rose-400">
            {bet.loser_id === currentUserId ? "you" : nameOf(bet.loser_id)}
          </span>{" "}
          {bet.status === "COMPLETED" ? "paid up" : `owes ${bet.stake}`}
        </p>
      )}

      {canAccept && (
        <button
          type="button"
          onClick={() => onAccept(bet.id)}
          disabled={accepting}
          className="relative z-10 mt-4 min-h-11 w-full rounded-xl bg-emerald-500 text-sm font-bold text-emerald-950
            transition-colors hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-50
            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
        >
          {accepting ? "Taking it…" : `Take ${oppositeOf(bet.creator_side)} — ${bet.stake}`}
        </button>
      )}
    </Card>
  );
}
