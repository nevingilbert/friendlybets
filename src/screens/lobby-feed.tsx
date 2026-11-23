"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { BetCard } from "@/components/bet-card";
import { CreateBetModal } from "@/components/create-bet-modal";
import { icons } from "@/components/icons";
import { ShareLobbyModal } from "@/components/share-lobby-modal";
import { IconButton, TopBar } from "@/components/top-bar";
import { Alert, Avatar, Button, EmptyState } from "@/components/ui";
import { useLobbyData } from "@/hooks/use-lobby-data";
import { useTicker } from "@/hooks/use-ticker";
import type { LobbySnapshot, Me } from "@/lib/types";
import { messageOf, unwrap } from "@/lib/unwrap";
import { betTransitionAction } from "@/server/actions";
import { FullScreenMessage } from "@/screens/full-screen-message";

const TABS = [
  { key: "open", label: "Open" },
  { key: "mine", label: "Mine" },
  { key: "all", label: "All" },
] as const;

type Tab = (typeof TABS)[number]["key"];

export function LobbyFeed({ lobbyId, me, initial }: { lobbyId: string; me: Me; initial: LobbySnapshot | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { lobby, members, bets, error, nameOf, refresh } = useLobbyData(lobbyId, initial);
  const now = useTicker();

  const [tab, setTab] = useState<Tab>("open");
  const [showCreate, setShowCreate] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [actionError, setActionError] = useState("");
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  // A brand new lobby is empty and pointless alone, so ?welcome=1 (set right after
  // creating one) opens Share straight away.
  const welcoming = searchParams.get("welcome") === "1";
  const shareOpen = showShare || (welcoming && Boolean(lobby));

  const closeShare = () => {
    setShowShare(false);
    if (welcoming) router.replace(pathname, { scroll: false });
  };

  const visibleBets = useMemo(() => {
    if (tab === "open") return bets.filter((bet) => bet.status === "OPEN");
    if (tab === "mine") return bets.filter((bet) => bet.creator_id === me.id || bet.acceptor_id === me.id);
    return bets;
  }, [bets, tab, me.id]);

  const handleAccept = async (betId: string) => {
    setActionError("");
    setAcceptingId(betId);
    try {
      await unwrap(betTransitionAction(betId, "accept_bet"));
    } catch (err) {
      setActionError(messageOf(err));
    } finally {
      await refresh();
      setAcceptingId(null);
    }
  };

  if (error || !lobby) {
    return <FullScreenMessage title="Lobby" message={error || "Lobby not found."} />;
  }

  const archived = lobby.status === "ARCHIVED";
  const openCount = bets.filter((bet) => bet.status === "OPEN").length;

  return (
    <div className="min-h-screen bg-zinc-950">
      <TopBar
        title={lobby.name}
        subtitle={`${members.length} ${members.length === 1 ? "player" : "players"} · ${lobby.code}`}
        backTo="/"
        actions={
          <>
            <IconButton label="Invite friends" onClick={() => setShowShare(true)}>
              {icons.share}
            </IconButton>
            <IconButton label="Big screen view" href={`/lobby/${lobbyId}/dashboard`}>
              {icons.tv}
            </IconButton>
            <IconButton
              label={lobby.host_id === me.id ? "Manage lobby" : "Lobby settings"}
              href={`/lobby/${lobbyId}/manage`}
            >
              {icons.settings}
            </IconButton>
          </>
        }
      />

      <div className="sticky top-14 z-20 border-b border-zinc-800 bg-zinc-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-2xl" role="tablist" aria-label="Filter bets">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              onClick={() => setTab(item.key)}
              className={`min-h-11 flex-1 border-b-2 py-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-400 ${
                tab === item.key
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {item.label}
              {item.key === "open" && <span className="ml-1.5 text-xs text-zinc-500 tabular-nums">{openCount}</span>}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
        <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1">
          {members.map((member) => (
            <div key={member.user_id} className="flex shrink-0 items-center gap-1.5">
              <Avatar name={member.display_name} url={member.avatar_url} size="sm" />
              <span className="text-xs whitespace-nowrap text-zinc-500">
                {member.user_id === me.id ? "You" : member.display_name}
              </span>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setShowShare(true)}
            className="min-h-11 shrink-0 rounded-full border border-dashed border-zinc-700 px-3 text-xs text-zinc-500 hover:border-emerald-600 hover:text-emerald-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
          >
            + Invite
          </button>
        </div>

        {actionError && (
          <div className="mb-4">
            <Alert>{actionError}</Alert>
          </div>
        )}

        {archived && (
          <div className="mb-4">
            <Alert tone="info">This lobby is archived. No new bets can be created.</Alert>
          </div>
        )}

        {visibleBets.length === 0 ? (
          <EmptyState
            title={tab === "open" ? "No open bets" : tab === "mine" ? "You haven't bet yet" : "Nothing here yet"}
            hint={tab === "open" ? "Post one and see who bites." : "Take someone up on an open bet, or post your own."}
            action={!archived && <Button onClick={() => setShowCreate(true)}>Post the first bet</Button>}
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {visibleBets.map((bet) => (
              <li key={bet.id}>
                <BetCard
                  bet={bet}
                  lobbyId={lobbyId}
                  currentUserId={me.id}
                  nameOf={nameOf}
                  now={now}
                  onAccept={handleAccept}
                  accepting={acceptingId === bet.id}
                />
              </li>
            ))}
          </ul>
        )}
      </main>

      {!archived && (
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          aria-label="Create a bet"
          style={{ bottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
          className="fixed right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-3xl leading-none font-light text-emerald-950 shadow-lg transition-colors hover:bg-emerald-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
        >
          +
        </button>
      )}

      {showCreate && <CreateBetModal lobbyId={lobbyId} onClose={() => setShowCreate(false)} onCreated={refresh} />}
      {shareOpen && <ShareLobbyModal lobby={lobby} onClose={closeShare} />}
    </div>
  );
}
