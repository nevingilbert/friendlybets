import "server-only";

import { requireSql } from "@/lib/db/client";
import type { LobbyStatus, Side } from "@/lib/types";

/**
 * Writes. Each one calls a plpgsql function that re-checks who is allowed to do it,
 * so this layer only shapes arguments. `userId` always comes from the session.
 */

export async function upsertUser(input: {
  googleSub: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}): Promise<{ user_id: string }> {
  const sql = requireSql();
  const rows = await sql<{ r: { user_id: string } }[]>`
    select public.upsert_user(
      ${input.googleSub}, ${input.email}, ${input.name}, ${input.avatarUrl}
    ) as r
  `;
  return rows[0].r;
}

export async function renameUser(userId: string, displayName: string): Promise<void> {
  const sql = requireSql();
  await sql`select public.rename_user(${userId}, ${displayName})`;
}

export async function createLobby(userId: string, name: string): Promise<{ id: string }> {
  const sql = requireSql();
  const rows = await sql<{ id: string }[]>`select id from public.create_lobby(${userId}, ${name})`;
  return rows[0];
}

export async function joinLobby(userId: string, code: string): Promise<{ id: string }> {
  const sql = requireSql();
  const rows = await sql<{ id: string }[]>`select id from public.join_lobby(${userId}, ${code})`;
  return rows[0];
}

export async function leaveLobby(userId: string, lobbyId: string): Promise<void> {
  const sql = requireSql();
  await sql`select public.leave_lobby(${userId}, ${lobbyId})`;
}

export async function updateLobby(
  userId: string,
  lobbyId: string,
  changes: { name?: string | null; status?: LobbyStatus | null },
): Promise<void> {
  const sql = requireSql();
  await sql`
    select public.update_lobby(${userId}, ${lobbyId}, ${changes.name ?? null}, ${changes.status ?? null})
  `;
}

export async function removeMember(userId: string, lobbyId: string, memberId: string): Promise<void> {
  const sql = requireSql();
  await sql`select public.remove_member(${userId}, ${lobbyId}, ${memberId})`;
}

export async function createBet(
  userId: string,
  lobbyId: string,
  bet: { proposition: string; stake: string; side: Side },
): Promise<void> {
  const sql = requireSql();
  await sql`
    select public.create_bet(${userId}, ${lobbyId}, ${bet.proposition}, ${bet.stake}, ${bet.side})
  `;
}

/** The single-argument bet transitions, by the name of their database function. */
export type BetTransition =
  | "accept_bet"
  | "cancel_bet"
  | "complete_bet"
  | "host_undo_accept"
  | "host_delete_bet";

export async function transitionBet(
  userId: string,
  betId: string,
  transition: BetTransition,
): Promise<void> {
  const sql = requireSql();
  // Spelled out rather than interpolating the function name: no identifier in a
  // query is ever built from a string.
  switch (transition) {
    case "accept_bet":
      await sql`select public.accept_bet(${userId}, ${betId})`;
      return;
    case "cancel_bet":
      await sql`select public.cancel_bet(${userId}, ${betId})`;
      return;
    case "complete_bet":
      await sql`select public.complete_bet(${userId}, ${betId})`;
      return;
    case "host_undo_accept":
      await sql`select public.host_undo_accept(${userId}, ${betId})`;
      return;
    case "host_delete_bet":
      await sql`select public.host_delete_bet(${userId}, ${betId})`;
      return;
  }
}

export async function resolveBet(userId: string, betId: string, outcome: Side): Promise<void> {
  const sql = requireSql();
  await sql`select public.resolve_bet(${userId}, ${betId}, ${outcome})`;
}
