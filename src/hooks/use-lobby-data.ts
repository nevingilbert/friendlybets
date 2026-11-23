"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { LobbySnapshot, Member } from "@/lib/types";

/** How often an open lobby screen asks for changes. */
const POLL_MS = 3000;

const NO_ACCESS = "This lobby does not exist, or you have not joined it yet.";
const REMOVED = "You are no longer in this lobby.";

export type PersonView = { id: string; role: Member["role"]; name: string; avatarUrl: string | null };

/**
 * A lobby, kept live by polling — the replacement for Supabase Realtime.
 *
 * The page renders the first snapshot on the server, so there is no loading spinner;
 * from then on the browser asks `/api/lobby/[id]` every few seconds while the tab is
 * visible and stops entirely while it is hidden, so a phone in a pocket costs nothing
 * and the database is allowed to sleep. Waking the tab or coming back online asks
 * immediately. Polling cannot miss an event the way a dropped socket can: every
 * response is the whole truth, not a diff.
 *
 * A 401/403 means you were signed out or removed. Anything else (a 503, a network
 * blip) keeps what is on screen and tries again on the next tick.
 */
export function useLobbyData(lobbyId: string, initial: LobbySnapshot | null) {
  const [snapshot, setSnapshot] = useState<LobbySnapshot | null>(initial);
  const [error, setError] = useState(initial ? "" : NO_ACCESS);
  const inFlight = useRef(false);
  const again = useRef(false);
  const hadAccess = useRef(initial !== null);

  const pollOnce = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(`/api/lobby/${lobbyId}`, { cache: "no-store" });
      if (response.status === 401 || response.status === 403 || response.status === 404) {
        setError(hadAccess.current ? REMOVED : NO_ACCESS);
        return;
      }
      if (!response.ok) return;
      const body = (await response.json()) as { snapshot: LobbySnapshot | null };
      if (body.snapshot) {
        hadAccess.current = true;
        setSnapshot(body.snapshot);
        setError("");
      }
    } catch {
      // Offline or a blip: keep what is on screen; the next tick tries again.
    }
  }, [lobbyId]);

  const refresh = useCallback(async (): Promise<void> => {
    // A refresh asked for mid-poll (say, right after a write) must not be dropped:
    // the poll already running may have read the database before the write landed.
    if (inFlight.current) {
      again.current = true;
      return;
    }
    inFlight.current = true;
    try {
      do {
        again.current = false;
        await pollOnce();
      } while (again.current);
    } finally {
      inFlight.current = false;
    }
  }, [pollOnce]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer) return;
      timer = setInterval(refresh, POLL_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        refresh();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", refresh);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", refresh);
    };
  }, [refresh]);

  const members = useMemo(() => snapshot?.members ?? [], [snapshot]);

  const memberMap = useMemo(() => {
    const map = new Map<string, PersonView>();
    for (const member of members) {
      map.set(member.user_id, {
        id: member.user_id,
        role: member.role,
        name: member.display_name,
        avatarUrl: member.avatar_url,
      });
    }
    return map;
  }, [members]);

  const names = snapshot?.names;
  const nameOf = useCallback(
    (userId: string | null | undefined): string => {
      if (!userId) return "";
      return memberMap.get(userId)?.name ?? names?.[userId] ?? "A former player";
    },
    [memberMap, names],
  );

  return {
    lobby: snapshot?.lobby ?? null,
    members,
    memberMap,
    bets: snapshot?.bets ?? [],
    leaderboard: snapshot?.leaderboard ?? [],
    error,
    nameOf,
    refresh,
  };
}

export type NameOf = ReturnType<typeof useLobbyData>["nameOf"];
