"use client";

import { useState } from "react";

import { TopBar } from "@/components/top-bar";
import { Alert, Avatar, Button, Card, SidePill, StatusPill } from "@/components/ui";
import { useLobbyData, type PersonView } from "@/hooks/use-lobby-data";
import { oppositeOf } from "@/lib/bets";
import { formatDateTime } from "@/lib/format";
import type { LobbySnapshot, Me, Side } from "@/lib/types";
import { messageOf, unwrap } from "@/lib/unwrap";
import { betTransitionAction, resolveBetAction } from "@/server/actions";
import { FullScreenMessage } from "@/screens/full-screen-message";

export function BetDetail({
  lobbyId,
  betId,
  me,
  initial,
}: {
  lobbyId: string;
  betId: string;
  me: Me;
  initial: LobbySnapshot | null;
}) {
  const { lobby, memberMap, bets, error, nameOf, refresh } = useLobbyData(lobbyId, initial);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const bet = bets.find((row) => row.id === betId);

  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setActionError("");
    try {
      await work();
    } catch (err) {
      setActionError(messageOf(err));
    } finally {
      await refresh();
      setBusy(false);
    }
  };

  if (error || !lobby) {
    return <FullScreenMessage title="Bet" message={error || "Lobby not found."} />;
  }

  if (!bet) {
    return (
      <FullScreenMessage
        title="Bet"
        message="This bet no longer exists — the host may have removed it."
        backTo={`/lobby/${lobbyId}`}
        backLabel="Back to the lobby"
      />
    );
  }

  const isCreator = bet.creator_id === me.id;
  const isAcceptor = bet.acceptor_id === me.id;
  const isParticipant = isCreator || isAcceptor;
  const acceptorSide = oppositeOf(bet.creator_side);
  const transition = (name: Parameters<typeof betTransitionAction>[1]) =>
    run(() => unwrap(betTransitionAction(bet.id, name)));
  const resolve = (outcome: Side) => run(() => unwrap(resolveBetAction(bet.id, outcome)));

  return (
    <div className="min-h-screen bg-zinc-950">
      <TopBar title={lobby.name} subtitle="Bet details" backTo={`/lobby/${lobbyId}`} />

      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-5">
        <Card className="animate-fade-up p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <StatusPill status={bet.status} />
            <span className="text-xs text-zinc-500">{formatDateTime(bet.created_at)}</span>
          </div>

          <h1 className="text-2xl leading-snug font-bold text-balance text-zinc-50">{bet.proposition}</h1>

          <div className="mt-5 rounded-xl border border-violet-500/25 bg-violet-500/10 px-4 py-3 text-center">
            <p className="text-xs font-medium tracking-widest text-violet-400 uppercase">On the line</p>
            <p className="mt-1 text-2xl font-extrabold text-violet-200">{bet.stake}</p>
          </div>

          <div className="mt-5 flex flex-col gap-2.5">
            <SideRow
              label="Created by"
              person={memberMap.get(bet.creator_id)}
              fallbackName={nameOf(bet.creator_id)}
              side={bet.creator_side}
              isYou={isCreator}
            />
            {bet.acceptor_id ? (
              <SideRow
                label="Taken by"
                person={memberMap.get(bet.acceptor_id)}
                fallbackName={nameOf(bet.acceptor_id)}
                side={acceptorSide}
                isYou={isAcceptor}
              />
            ) : (
              bet.status === "OPEN" && (
                <div className="rounded-xl border border-dashed border-zinc-700 px-4 py-3 text-center text-sm text-zinc-500">
                  Nobody has taken <SidePill side={acceptorSide} /> yet
                </div>
              )
            )}
          </div>

          {bet.outcome && (
            <div className="mt-5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
              <p className="text-sm text-amber-200">
                Outcome: <strong>{bet.outcome}</strong>
              </p>
              <p className="mt-1 text-sm text-zinc-300">
                <span className="font-semibold text-emerald-400">{nameOf(bet.winner_id)}</span> won ·{" "}
                <span className="font-semibold text-rose-400">{nameOf(bet.loser_id)}</span>{" "}
                {bet.status === "COMPLETED" ? "has paid up" : `owes ${bet.stake}`}
              </p>
            </div>
          )}

          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-zinc-800 pt-4 text-xs">
            <Timestamp label="Created" value={bet.created_at} />
            <Timestamp label="Taken" value={bet.accepted_at} />
            <Timestamp label="Resolved" value={bet.resolved_at} />
            <Timestamp label="Settled" value={bet.completed_at} />
          </dl>
        </Card>

        <Alert>{actionError}</Alert>

        {bet.status === "OPEN" && !isCreator && (
          <Button disabled={busy} onClick={() => transition("accept_bet")}>
            {busy ? "Taking it…" : `Take ${acceptorSide} — ${bet.stake}`}
          </Button>
        )}

        {bet.status === "OPEN" && isCreator && (
          <Button variant="secondary" disabled={busy} onClick={() => transition("cancel_bet")}>
            {busy ? "Cancelling…" : "Cancel this bet"}
          </Button>
        )}

        {bet.status === "ACCEPTED" && isParticipant && (
          <div className="flex flex-col gap-2">
            <p className="text-center text-sm text-zinc-500">What actually happened?</p>
            <div className="grid grid-cols-2 gap-3">
              <Button disabled={busy} onClick={() => resolve("YES")}>
                YES happened
              </Button>
              <Button variant="danger" disabled={busy} onClick={() => resolve("NO")}>
                NO happened
              </Button>
            </div>
            <p className="text-center text-xs text-zinc-500">Either of you can call it. First call stands — honour system.</p>
          </div>
        )}

        {bet.status === "RESOLVED" && isParticipant && (
          <Button variant="secondary" disabled={busy} onClick={() => transition("complete_bet")}>
            {busy ? "Saving…" : "Mark the stake as paid"}
          </Button>
        )}
      </main>
    </div>
  );
}

function SideRow({
  label,
  person,
  fallbackName,
  side,
  isYou,
}: {
  label: string;
  person: PersonView | undefined;
  fallbackName: string;
  side: Side;
  isYou: boolean;
}) {
  const name = person?.name ?? fallbackName;
  return (
    <div className="flex items-center gap-3 rounded-xl bg-zinc-950/60 px-4 py-3">
      <Avatar name={name} url={person?.avatarUrl} />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-zinc-500">{label}</p>
        <p className="truncate font-semibold text-zinc-100">{isYou ? "You" : name}</p>
      </div>
      <SidePill side={side} />
    </div>
  );
}

function Timestamp({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-right text-zinc-400">{formatDateTime(value)}</dd>
    </>
  );
}
