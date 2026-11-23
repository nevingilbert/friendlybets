import { Avatar } from "@/components/ui";
import type { LeaderboardRow } from "@/lib/types";

const RANK_ACCENT = [
  "border-l-4 border-amber-400 bg-amber-400/10",
  "border-l-4 border-zinc-400 bg-zinc-400/10",
  "border-l-4 border-amber-700 bg-amber-700/10",
];

const GRID = "grid grid-cols-[2rem_1fr_2.5rem_2.5rem_3.5rem] items-center gap-2";

export function Leaderboard({ rows }: { rows: LeaderboardRow[] }) {
  const ranked = rows.filter((row) => row.total_bets > 0);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
      <h2 className="tv-section mb-4 font-bold tracking-widest text-zinc-400 uppercase">Standings</h2>

      {ranked.length === 0 ? (
        <p className="tv-body py-8 text-center text-zinc-500">No bets settled yet</p>
      ) : (
        <>
          <div className={`${GRID} border-b border-zinc-800 px-3 pb-2`}>
            {["#", "Player", "W", "L", "Owes"].map((heading, index) => (
              <span
                key={heading}
                className={`tv-label font-semibold tracking-wider text-zinc-500 uppercase ${index >= 2 ? "text-center" : ""}`}
              >
                {heading}
              </span>
            ))}
          </div>

          <ul className="mt-2 flex min-h-0 flex-col gap-1 overflow-y-auto">
            {ranked.map((row, index) => (
              <li key={row.user_id} className={`${GRID} rounded-lg px-3 py-2.5 ${RANK_ACCENT[index] ?? ""}`}>
                <span className="tv-body font-bold text-zinc-500">{index + 1}</span>
                <span className="flex min-w-0 items-center gap-2.5">
                  <Avatar name={row.display_name} url={row.avatar_url} size="sm" />
                  <span className="tv-name truncate font-semibold text-zinc-100">{row.display_name}</span>
                </span>
                <span className="tv-name text-center font-bold text-emerald-400 tabular-nums">{row.wins}</span>
                <span className="tv-name text-center font-bold text-rose-400 tabular-nums">{row.losses}</span>
                <span
                  className={`tv-name text-center font-bold tabular-nums ${row.outstanding > 0 ? "text-amber-400" : "text-zinc-600"}`}
                >
                  {row.outstanding}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
