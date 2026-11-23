import type { ReactNode } from "react";

import type { NameOf } from "@/hooks/use-lobby-data";
import { lastTouched } from "@/lib/bets";
import { formatRelative } from "@/lib/format";
import type { Bet, BetStatus } from "@/lib/types";

const ACCENT: Record<BetStatus, string> = {
  OPEN: "border-l-emerald-500",
  ACCEPTED: "border-l-sky-500",
  RESOLVED: "border-l-amber-500",
  COMPLETED: "border-l-zinc-500",
  CANCELLED: "border-l-zinc-700",
};

const TONES = {
  zinc: "text-zinc-100",
  emerald: "text-emerald-400",
  sky: "text-sky-400",
  rose: "text-rose-400",
} as const;

function truncate(text: string, max = 70) {
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function Name({ children, tone = "zinc" }: { children: ReactNode; tone?: keyof typeof TONES }) {
  return <span className={`font-semibold ${TONES[tone]}`}>{children}</span>;
}

function describe(bet: Bet, nameOf: NameOf) {
  const prop = <span className="text-zinc-400">“{truncate(bet.proposition)}”</span>;
  const stake = <span className="font-semibold text-violet-300">{bet.stake}</span>;

  switch (bet.status) {
    case "ACCEPTED":
      return (
        <>
          <Name tone="sky">{nameOf(bet.acceptor_id)}</Name> took <Name>{nameOf(bet.creator_id)}</Name>
          &rsquo;s bet — {stake} on {prop}
        </>
      );
    case "RESOLVED":
      return (
        <>
          <Name tone="emerald">{nameOf(bet.winner_id)}</Name> beat <Name tone="rose">{nameOf(bet.loser_id)}</Name> for{" "}
          {stake} on {prop}
        </>
      );
    case "COMPLETED":
      return (
        <>
          <Name>{nameOf(bet.loser_id)}</Name> paid up — {stake} on {prop}
        </>
      );
    case "CANCELLED":
      return (
        <>
          <Name>{nameOf(bet.creator_id)}</Name> pulled {prop}
        </>
      );
    default:
      return (
        <>
          <Name tone="emerald">{nameOf(bet.creator_id)}</Name> posted {stake} on {prop}
        </>
      );
  }
}

export function ActivityFeed({ bets, nameOf, now }: { bets: Bet[]; nameOf: NameOf; now: number }) {
  const items = bets.slice(0, 12);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
      <h2 className="tv-section mb-4 font-bold tracking-widest text-zinc-400 uppercase">Activity</h2>
      {items.length === 0 ? (
        <p className="tv-body py-8 text-center text-zinc-500">Nothing has happened yet</p>
      ) : (
        <ul className="flex min-h-0 flex-col gap-2 overflow-y-auto">
          {items.map((bet) => (
            <li
              key={`${bet.id}-${bet.status}`}
              className={`animate-fade-up rounded-r-lg border-l-4 bg-zinc-800/40 px-4 py-3 ${ACCENT[bet.status]}`}
            >
              <p className="tv-body leading-relaxed text-zinc-300">{describe(bet, nameOf)}</p>
              <p className="tv-label mt-0.5 text-zinc-500">{formatRelative(lastTouched(bet), now)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
