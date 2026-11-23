import { loadLobbyPage } from "@/server/lobby-page";
import { LobbyFeed } from "@/screens/lobby-feed";
import { SignInGate } from "@/screens/sign-in-gate";

export const dynamic = "force-dynamic";

export default async function LobbyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const page = await loadLobbyPage(id);
  if (!page.me) return <SignInGate returnTo={`/lobby/${id}`} />;
  return <LobbyFeed lobbyId={id} me={page.me} initial={page.initial} />;
}
