import { currentUser } from "@/auth";
import { previewLobby } from "@/lib/db/queries";
import { joinCodeSchema } from "@/lib/validation";
import { JoinLobby } from "@/screens/join-lobby";
import { FullScreenMessage } from "@/screens/full-screen-message";

export const dynamic = "force-dynamic";

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const parsed = joinCodeSchema.safeParse(decodeURIComponent(code));
  const preview = parsed.success ? await previewLobby(parsed.data) : null;

  if (!preview) {
    return (
      <FullScreenMessage
        title="Invite"
        message={`No lobby has the code ${code.toUpperCase()}. Double-check the link.`}
        backLabel="Go to FriendlyBets"
      />
    );
  }

  const me = await currentUser();
  return <JoinLobby preview={preview} signedIn={me !== null} />;
}
