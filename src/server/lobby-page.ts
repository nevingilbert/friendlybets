import "server-only";

import { currentUser } from "@/auth";
import { loadLobbySnapshot } from "@/lib/db/queries";
import type { LobbySnapshot, Me } from "@/lib/types";
import { isUuid } from "@/lib/validation";

/**
 * What every /lobby/[id]/* page needs before it renders: who is asking, and the first
 * snapshot — rendered on the server so the page arrives complete, then kept live by
 * the client's poll. A null snapshot means "not a member" and the screen says so.
 */
export async function loadLobbyPage(
  lobbyId: string,
): Promise<{ me: null } | { me: Me; initial: LobbySnapshot | null }> {
  const me = await currentUser();
  if (!me) return { me: null };
  return { me, initial: isUuid(lobbyId) ? await loadLobbySnapshot(lobbyId, me.id) : null };
}
