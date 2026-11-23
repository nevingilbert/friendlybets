import { loadLobbyPage } from "@/server/lobby-page";
import { BetDetail } from "@/screens/bet-detail";
import { SignInGate } from "@/screens/sign-in-gate";

export const dynamic = "force-dynamic";

export default async function BetPage({ params }: { params: Promise<{ id: string; betId: string }> }) {
  const { id, betId } = await params;
  const page = await loadLobbyPage(id);
  if (!page.me) return <SignInGate returnTo={`/lobby/${id}/bet/${betId}`} />;
  return <BetDetail lobbyId={id} betId={betId} me={page.me} initial={page.initial} />;
}
