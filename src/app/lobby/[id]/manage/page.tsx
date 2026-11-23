import { loadLobbyPage } from "@/server/lobby-page";
import { LobbyManage } from "@/screens/lobby-manage";
import { SignInGate } from "@/screens/sign-in-gate";

export const dynamic = "force-dynamic";

export default async function ManagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const page = await loadLobbyPage(id);
  if (!page.me) return <SignInGate returnTo={`/lobby/${id}/manage`} />;
  return <LobbyManage lobbyId={id} me={page.me} initial={page.initial} />;
}
