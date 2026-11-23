"use client";

import { useState, type FormEvent } from "react";

import { Alert, Button, Field, Input, Modal, Textarea } from "@/components/ui";
import { oppositeOf } from "@/lib/bets";
import type { Side } from "@/lib/types";
import { messageOf, unwrap } from "@/lib/unwrap";
import { createBetAction } from "@/server/actions";

// Written out in full because Tailwind only compiles class names it can see as
// complete literals — `border-${tone}-500` would never be generated.
const SIDE_OPTIONS: { value: Side; selectedClass: string }[] = [
  { value: "YES", selectedClass: "border-emerald-500 bg-emerald-500/15 text-emerald-300" },
  { value: "NO", selectedClass: "border-rose-500 bg-rose-500/15 text-rose-300" },
];

export function CreateBetModal({
  lobbyId,
  onClose,
  onCreated,
}: {
  lobbyId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [proposition, setProposition] = useState("");
  const [stake, setStake] = useState("");
  const [side, setSide] = useState<Side | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!proposition.trim()) return setError("What are you betting on?");
    if (!stake.trim()) return setError("What's on the line?");
    if (!side) return setError("Pick your side.");

    setBusy(true);
    setError("");
    try {
      await unwrap(createBetAction(lobbyId, { proposition: proposition.trim(), stake: stake.trim(), side }));
      onCreated();
      onClose();
    } catch (err) {
      setError(messageOf(err));
      setBusy(false);
    }
  };

  return (
    <Modal title="New bet" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="The bet" hint="Phrase it so YES or NO is unambiguous.">
          <Textarea
            autoFocus
            rows={3}
            maxLength={280}
            value={proposition}
            onChange={(event) => setProposition(event.target.value)}
            placeholder="The first play of the game is a run"
          />
        </Field>

        <Field label="What's on the line" hint="Both sides risk the same thing.">
          <Input
            maxLength={120}
            value={stake}
            onChange={(event) => setStake(event.target.value)}
            placeholder="A shot · the dishes · $5"
          />
        </Field>

        <fieldset>
          <legend className="mb-2 block text-sm font-medium text-zinc-300">Your side</legend>
          <div className="grid grid-cols-2 gap-3">
            {SIDE_OPTIONS.map(({ value, selectedClass }) => {
              const selected = side === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setSide(value)}
                  className={`min-h-13 rounded-xl border-2 text-lg font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
                    selected ? selectedClass : "border-zinc-700 bg-zinc-950/60 text-zinc-400 hover:border-zinc-600"
                  }`}
                >
                  {value}
                </button>
              );
            })}
          </div>
          {side && (
            <p className="mt-2 text-xs text-zinc-500">
              Whoever takes it is betting <span className="font-semibold text-zinc-300">{oppositeOf(side)}</span>.
            </p>
          )}
        </fieldset>

        <Alert>{error}</Alert>

        <Button type="submit" disabled={busy}>
          {busy ? "Posting…" : "Post bet"}
        </Button>
      </form>
    </Modal>
  );
}
