import { loadLobbyPage } from "@/server/lobby-page";
import { LobbyDashboard } from "@/screens/lobby-dashboard";
import { SignInGate } from "@/screens/sign-in-gate";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const page = await loadLobbyPage(id);
  if (!page.me) return <SignInGate returnTo={`/lobby/${id}/dashboard`} />;
  return <LobbyDashboard lobbyId={id} initial={page.initial} />;
}
