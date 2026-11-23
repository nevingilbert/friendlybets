"use client";

import Link from "next/link";
import { useMemo } from "react";

import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { Leaderboard } from "@/components/dashboard/leaderboard";
import { OpenBetsTicker } from "@/components/dashboard/open-bets-ticker";
import { StatsBar } from "@/components/dashboard/stats-bar";
import { QrCode } from "@/components/qr-code";
import { Alert } from "@/components/ui";
import { useLobbyData } from "@/hooks/use-lobby-data";
import { inviteUrlFor, useOrigin } from "@/hooks/use-origin";
import { useTicker } from "@/hooks/use-ticker";
import { lastTouched } from "@/lib/bets";
import type { LobbySnapshot } from "@/lib/types";

/**
 * TV mode. Read-only and large: everything here has to be legible from across a room,
 * and it polls on its own so nobody ever needs to touch the laptop.
 */
export function LobbyDashboard({ lobbyId, initial }: { lobbyId: string; initial: LobbySnapshot | null }) {
  const { lobby, members, bets, leaderboard, error, nameOf } = useLobbyData(lobbyId, initial);
  const now = useTicker();
  const origin = useOrigin();

  const openBets = useMemo(() => bets.filter((bet) => bet.status === "OPEN"), [bets]);
  const activity = useMemo(
    () => [...bets].sort((a, b) => new Date(lastTouched(b)).getTime() - new Date(lastTouched(a)).getTime()),
    [bets],
  );

  if (error || !lobby) {
    return (
      <div className="tv-pad mx-auto flex max-w-xl flex-col gap-4 py-16">
        <Alert>{error || "Lobby not found."}</Alert>
        <Link href="/" className="tv-label text-emerald-400 underline">
          Back to your lobbies
        </Link>
      </div>
    );
  }

  const stats = {
    open: openBets.length,
    active: bets.filter((bet) => bet.status === "ACCEPTED").length,
    owed: bets.filter((bet) => bet.status === "RESOLVED").length,
    players: members.length,
  };
  const inviteUrl = origin ? inviteUrlFor(origin, lobby.code) : "";

  return (
    <div className="tv-pad flex min-h-screen flex-col gap-5 bg-zinc-950">
      <header className="flex items-center justify-between gap-6">
        <div className="min-w-0">
          <p className="tv-label font-semibold tracking-[0.3em] text-emerald-500 uppercase">FriendlyBets</p>
          <h1 className="tv-hero truncate font-extrabold text-zinc-50">{lobby.name}</h1>
        </div>
        <Link href={`/lobby/${lobbyId}`} className="tv-label shrink-0 rounded-lg px-3 py-2 text-zinc-500 hover:text-zinc-300">
          Exit big screen
        </Link>
      </header>

      <StatsBar stats={stats} />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex min-h-0 flex-col gap-5 lg:col-span-2">
          <OpenBetsTicker bets={openBets} nameOf={nameOf} />
          <div className="min-h-0 flex-1">
            <ActivityFeed bets={activity} nameOf={nameOf} now={now} />
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-5">
          <div className="min-h-0 flex-1">
            <Leaderboard rows={leaderboard} />
          </div>

          <div className="flex shrink-0 items-center gap-5 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
            <QrCode value={inviteUrl} size={200} className="tv-qr p-2" />
            <div className="min-w-0">
              <p className="tv-label font-semibold tracking-widest text-zinc-500 uppercase">Scan to join</p>
              <p className="tv-code mt-1 font-mono font-bold tracking-[0.2em] text-emerald-400">{lobby.code}</p>
              <p className="tv-label mt-1 truncate text-zinc-500">{inviteUrl.replace(/^https?:\/\//, "")}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
