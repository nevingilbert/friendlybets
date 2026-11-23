"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { currentUserId, signIn, signOut } from "@/auth";
import * as db from "@/lib/db/mutations";
import { BadInputError, NotSignedInError } from "@/lib/errors";
import type { ActionResult } from "@/lib/types";
import {
  displayNameSchema,
  joinCodeSchema,
  lobbyNameSchema,
  lobbyStatusSchema,
  newBetSchema,
  sideSchema,
  uuidSchema,
} from "@/lib/validation";
import { describeError } from "@/server/describe-error";

/**
 * Every mutation the app makes. Each one:
 *   1. takes the user id from the session, never from the caller,
 *   2. validates its arguments with Zod (a client can send anything),
 *   3. calls one plpgsql function, which checks permissions again,
 *   4. returns { ok, data } / { ok, error } — nothing is thrown across the wire.
 *
 * The lobby screens poll for changes, so a write does not need to push anything; the
 * caller asks for a fresh snapshot as soon as the action resolves.
 */

async function requireUserId(): Promise<string> {
  const userId = await currentUserId();
  if (!userId) throw new NotSignedInError("Your session expired — sign in again.");
  return userId;
}

async function attempt<T>(work: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    if (error instanceof BadInputError) return { ok: false, error: error.message };
    if (error instanceof z.ZodError) {
      return { ok: false, error: error.issues[0]?.message ?? "Check what you entered." };
    }
    return { ok: false, error: describeError(error) };
  }
}

// --- auth --------------------------------------------------------------------

export async function signInWithGoogle(redirectTo: string): Promise<void> {
  // Only ever a path on this site — an absolute URL here would be an open redirect.
  const safe = redirectTo.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : "/";
  await signIn("google", { redirectTo: safe });
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}

export async function renameSelfAction(displayName: string): Promise<ActionResult> {
  return attempt(async () => {
    const userId = await requireUserId();
    await db.renameUser(userId, displayNameSchema.parse(displayName));
    // The name is shown in the layout's top bar, so re-render it everywhere.
    revalidatePath("/", "layout");
    return null;
  });
}

// --- lobbies -----------------------------------------------------------------

export async function createLobbyAction(name: string): Promise<ActionResult<{ id: string }>> {
  return attempt(async () => {
    const userId = await requireUserId();
    return db.createLobby(userId, lobbyNameSchema.parse(name));
  });
}

export async function joinLobbyAction(code: string): Promise<ActionResult<{ id: string }>> {
  return attempt(async () => {
    const userId = await requireUserId();
    return db.joinLobby(userId, joinCodeSchema.parse(code));
  });
}

export async function leaveLobbyAction(lobbyId: string): Promise<ActionResult> {
  return attempt(async () => {
    const userId = await requireUserId();
    await db.leaveLobby(userId, uuidSchema.parse(lobbyId));
    revalidatePath("/");
    return null;
  });
}

export async function updateLobbyAction(
  lobbyId: string,
  changes: { name?: string; status?: string },
): Promise<ActionResult> {
  return attempt(async () => {
    const userId = await requireUserId();
    await db.updateLobby(userId, uuidSchema.parse(lobbyId), {
      name: changes.name === undefined ? null : lobbyNameSchema.parse(changes.name),
      status: changes.status === undefined ? null : lobbyStatusSchema.parse(changes.status),
    });
    return null;
  });
}

export async function removeMemberAction(lobbyId: string, memberId: string): Promise<ActionResult> {
  return attempt(async () => {
    const userId = await requireUserId();
    await db.removeMember(userId, uuidSchema.parse(lobbyId), uuidSchema.parse(memberId));
    return null;
  });
}

// --- bets --------------------------------------------------------------------

export async function createBetAction(
  lobbyId: string,
  bet: { proposition: string; stake: string; side: string | null },
): Promise<ActionResult> {
  return attempt(async () => {
    const userId = await requireUserId();
    const parsed = newBetSchema.safeParse(bet);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new BadInputError(issue?.path[0] === "side" ? "Pick your side." : (issue?.message ?? "Check the bet."));
    }
    await db.createBet(userId, uuidSchema.parse(lobbyId), parsed.data);
    return null;
  });
}

const transitionSchema = z.enum([
  "accept_bet",
  "cancel_bet",
  "complete_bet",
  "host_undo_accept",
  "host_delete_bet",
]);

export async function betTransitionAction(
  betId: string,
  transition: db.BetTransition,
): Promise<ActionResult> {
  return attempt(async () => {
    const userId = await requireUserId();
    await db.transitionBet(userId, uuidSchema.parse(betId), transitionSchema.parse(transition));
    return null;
  });
}

export async function resolveBetAction(betId: string, outcome: string): Promise<ActionResult> {
  return attempt(async () => {
    const userId = await requireUserId();
    await db.resolveBet(userId, uuidSchema.parse(betId), sideSchema.parse(outcome));
    return null;
  });
}
