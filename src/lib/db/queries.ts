import "server-only";

import { cache } from "react";

import { requireSql } from "@/lib/db/client";
import type { LobbyPreview, LobbySnapshot, LobbySummary, Me } from "@/lib/types";

/**
 * Reads. Every one of them is scoped to the signed-in user by an argument the server
 * supplies from the session — never by anything the browser sends.
 */

/** The signed-in person's row. Cached per request: the layout and the page both ask. */
export const getMe = cache(async (userId: string): Promise<Me | null> => {
  const sql = requireSql();
  const rows = await sql<Me[]>`
    select id, display_name, avatar_url from public.users where id = ${userId}
  `;
  return rows[0] ?? null;
});

export async function listMyLobbies(userId: string): Promise<LobbySummary[]> {
  const sql = requireSql();
  const rows = await sql<(LobbySummary & { created_at: Date; member_count: string })[]>`
    select * from public.my_lobbies(${userId})
  `;
  return rows.map((row) => ({
    ...row,
    created_at: row.created_at.toISOString(),
    member_count: Number(row.member_count),
  }));
}

export async function previewLobby(code: string): Promise<LobbyPreview | null> {
  const sql = requireSql();
  const rows = await sql<(LobbyPreview & { member_count: string })[]>`
    select * from public.lobby_preview(${code})
  `;
  const row = rows[0];
  return row ? { ...row, member_count: Number(row.member_count) } : null;
}

/** The whole lobby as one document, or null when this user is not a member. */
export async function loadLobbySnapshot(
  lobbyId: string,
  userId: string,
): Promise<LobbySnapshot | null> {
  const sql = requireSql();
  const rows = await sql<{ snapshot: LobbySnapshot | null }[]>`
    select public.lobby_snapshot(${lobbyId}, ${userId}) as snapshot
  `;
  return rows[0]?.snapshot ?? null;
}
