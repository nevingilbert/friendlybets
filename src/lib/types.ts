/**
 * Row shapes as the database returns them. Snake case on purpose: these arrive as
 * jsonb straight from `lobby_snapshot`, and renaming every field on the way through
 * would be a second schema to keep in sync with the first.
 */

export type Side = "YES" | "NO";
export type LobbyStatus = "OPEN" | "LOCKED" | "ARCHIVED";
export type BetStatus = "OPEN" | "ACCEPTED" | "RESOLVED" | "COMPLETED" | "CANCELLED";

export type Me = {
  id: string;
  display_name: string;
  avatar_url: string | null;
};

export type Lobby = {
  id: string;
  code: string;
  name: string;
  host_id: string;
  status: LobbyStatus;
  created_at: string;
};

export type LobbySummary = Lobby & { member_count: number };

export type LobbyPreview = {
  id: string;
  code: string;
  name: string;
  host_name: string;
  member_count: number;
  status: LobbyStatus;
};

export type Member = {
  user_id: string;
  role: "HOST" | "MEMBER";
  joined_at: string;
  display_name: string;
  avatar_url: string | null;
};

export type Bet = {
  id: string;
  lobby_id: string;
  proposition: string;
  stake: string;
  creator_id: string;
  creator_side: Side;
  acceptor_id: string | null;
  status: BetStatus;
  outcome: Side | null;
  winner_id: string | null;
  loser_id: string | null;
  created_at: string;
  accepted_at: string | null;
  resolved_at: string | null;
  completed_at: string | null;
};

export type LeaderboardRow = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  wins: number;
  losses: number;
  outstanding: number;
  total_bets: number;
};

export type LobbySnapshot = {
  lobby: Lobby;
  members: Member[];
  bets: Bet[];
  /** Display name for every user any bet mentions, including people who have left. */
  names: Record<string, string>;
  leaderboard: LeaderboardRow[];
};

/** What every Server Action returns: never throws across the wire. */
export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };
