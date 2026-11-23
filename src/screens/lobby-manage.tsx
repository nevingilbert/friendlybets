"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { TopBar } from "@/components/top-bar";
import { Alert, Avatar, Button, Card, Input, StatusPill } from "@/components/ui";
import { useLobbyData } from "@/hooks/use-lobby-data";
import { useTicker } from "@/hooks/use-ticker";
import { formatRelative } from "@/lib/format";
import type { LobbySnapshot, LobbyStatus, Me } from "@/lib/types";
import { messageOf, unwrap } from "@/lib/unwrap";
import {
  betTransitionAction,
  leaveLobbyAction,
  removeMemberAction,
  renameSelfAction,
  updateLobbyAction,
} from "@/server/actions";
import { FullScreenMessage } from "@/screens/full-screen-message";

const STATUS_CHOICES: { value: LobbyStatus; label: string; hint: string }[] = [
  { value: "OPEN", label: "Open", hint: "Anyone with the link can join." },
  { value: "LOCKED", label: "Locked", hint: "No new players, betting continues." },
  { value: "ARCHIVED", label: "Archived", hint: "Read-only. No new bets." },
];

/** Lobby settings. Host-only actions are enforced in Postgres; the UI is a convenience. */
export function LobbyManage({ lobbyId, me, initial }: { lobbyId: string; me: Me; initial: LobbySnapshot | null }) {
  const router = useRouter();
  const now = useTicker();
  const { lobby, members, bets, error, nameOf, refresh } = useLobbyData(lobbyId, initial);

  // null means "untouched" — the field shows the live value until someone types,
  // which avoids syncing state from props in an effect.
  const [draftName, setDraftName] = useState<string | null>(null);
  const [draftDisplayName, setDraftDisplayName] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);

  const name = draftName ?? lobby?.name ?? "";
  // Google hands us a full legal name; most people want something shorter.
  const displayName = draftDisplayName ?? me.display_name;

  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(() => setMessage(""), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  const run = async (work: () => Promise<unknown>, successMessage?: string) => {
    setBusy(true);
    setActionError("");
    try {
      await work();
      if (successMessage) setMessage(successMessage);
    } catch (err) {
      setActionError(messageOf(err));
    } finally {
      await refresh();
      setBusy(false);
    }
  };

  if (error || !lobby) {
    return <FullScreenMessage title="Lobby settings" message={error || "Lobby not found."} />;
  }

  const isHost = lobby.host_id === me.id;

  return (
    <div className="min-h-screen bg-zinc-950">
      <TopBar title="Lobby settings" subtitle={lobby.name} backTo={`/lobby/${lobbyId}`} />

      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-5">
        <Alert>{actionError}</Alert>
        {message && <Alert tone="success">{message}</Alert>}

        <Card className="p-5">
          <h2 className="mb-1 font-semibold text-zinc-100">Your display name</h2>
          <p className="mb-4 text-sm text-zinc-500">This is what everyone in your lobbies sees.</p>
          <div className="flex gap-2">
            <Input
              className="flex-1"
              aria-label="Your display name"
              value={displayName}
              maxLength={40}
              onChange={(event) => setDraftDisplayName(event.target.value)}
            />
            <Button
              className="shrink-0"
              disabled={busy || !displayName.trim() || displayName === me.display_name}
              onClick={() =>
                run(async () => {
                  await unwrap(renameSelfAction(displayName.trim()));
                  setDraftDisplayName(null);
                  router.refresh();
                }, "Name updated.")
              }
            >
              Save
            </Button>
          </div>
        </Card>

        {isHost && (
          <>
            <Card className="p-5">
              <h2 className="mb-4 font-semibold text-zinc-100">Lobby name</h2>
              <div className="flex gap-2">
                <Input
                  className="flex-1"
                  aria-label="Lobby name"
                  value={name}
                  maxLength={60}
                  onChange={(event) => setDraftName(event.target.value)}
                />
                <Button
                  className="shrink-0"
                  disabled={busy || !name.trim() || name === lobby.name}
                  onClick={() =>
                    run(async () => {
                      await unwrap(updateLobbyAction(lobbyId, { name: name.trim() }));
                      setDraftName(null);
                    }, "Renamed.")
                  }
                >
                  Save
                </Button>
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="mb-1 font-semibold text-zinc-100">Who can join</h2>
              <p className="mb-4 text-sm text-zinc-500">
                Join code <span className="font-mono text-emerald-400">{lobby.code}</span>
              </p>
              <div className="flex flex-col gap-2" role="radiogroup" aria-label="Who can join">
                {STATUS_CHOICES.map((choice) => {
                  const selected = lobby.status === choice.value;
                  return (
                    <button
                      key={choice.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={busy || selected}
                      onClick={() =>
                        run(
                          () => unwrap(updateLobbyAction(lobbyId, { status: choice.value })),
                          `Lobby is now ${choice.label.toLowerCase()}.`,
                        )
                      }
                      className={`rounded-xl border-2 px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
                        selected ? "border-emerald-500 bg-emerald-500/10" : "border-zinc-800 hover:border-zinc-700"
                      }`}
                    >
                      <p className="text-sm font-semibold text-zinc-100">
                        {choice.label}
                        {selected && <span className="ml-2 text-xs font-medium text-emerald-400">Current</span>}
                      </p>
                      <p className="text-xs text-zinc-500">{choice.hint}</p>
                    </button>
                  );
                })}
              </div>
            </Card>
          </>
        )}

        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-zinc-100">
            Players <span className="text-zinc-500">({members.length})</span>
          </h2>
          <ul className="flex flex-col divide-y divide-zinc-800">
            {members.map((member) => (
              <li key={member.user_id} className="flex items-center gap-3 py-3">
                <Avatar name={member.display_name} url={member.avatar_url} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-100">
                    {member.display_name}
                    {member.user_id === me.id && <span className="ml-1.5 text-xs text-zinc-500">(you)</span>}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {member.role === "HOST" ? "Host" : "Player"} · joined {formatRelative(member.joined_at, now)}
                  </p>
                </div>
                {isHost && member.role !== "HOST" && (
                  <Button
                    variant="ghost"
                    disabled={busy}
                    className="text-rose-400 hover:bg-rose-500/10"
                    onClick={() =>
                      run(
                        () => unwrap(removeMemberAction(lobbyId, member.user_id)),
                        `Removed ${member.display_name}.`,
                      )
                    }
                  >
                    Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>

        {isHost && (
          <Card className="p-5">
            <h2 className="mb-1 font-semibold text-zinc-100">Moderate bets</h2>
            <p className="mb-4 text-sm text-zinc-500">Reopen a bet someone took by mistake, or delete one entirely.</p>
            {bets.length === 0 ? (
              <p className="py-4 text-sm text-zinc-500">No bets yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-zinc-800">
                {bets.map((bet) => (
                  <li key={bet.id} className="flex flex-col gap-2.5 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 flex-1 text-sm text-zinc-200">{bet.proposition}</p>
                      <StatusPill status={bet.status} />
                    </div>
                    <p className="text-xs text-zinc-500">
                      {bet.stake} · {nameOf(bet.creator_id)} ({bet.creator_side})
                      {bet.acceptor_id && ` vs ${nameOf(bet.acceptor_id)}`}
                    </p>
                    <div className="flex gap-2">
                      {bet.status === "ACCEPTED" && (
                        <Button
                          variant="secondary"
                          disabled={busy}
                          onClick={() => run(() => unwrap(betTransitionAction(bet.id, "host_undo_accept")), "Bet reopened.")}
                        >
                          Undo accept
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        disabled={busy}
                        className="text-rose-400 hover:bg-rose-500/10"
                        onClick={() => run(() => unwrap(betTransitionAction(bet.id, "host_delete_bet")), "Bet deleted.")}
                      >
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {!isHost && (
          <Card className="p-5">
            <h2 className="mb-1 font-semibold text-zinc-100">Leave this lobby</h2>
            <p className="mb-4 text-sm text-zinc-500">Your bets stay on the board. You can rejoin with the code any time.</p>
            <Button
              variant="danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setActionError("");
                try {
                  await unwrap(leaveLobbyAction(lobbyId));
                  router.replace("/");
                } catch (err) {
                  setActionError(messageOf(err));
                  setBusy(false);
                }
              }}
            >
              Leave lobby
            </Button>
          </Card>
        )}
      </main>
    </div>
  );
}
