import { currentUser } from "@/auth";
import { listMyLobbies } from "@/lib/db/queries";
import { Lobbies } from "@/screens/lobbies";
import { SignInGate, signInErrorMessage } from "@/screens/sign-in-gate";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await currentUser();
  if (!me) {
    const { error } = await searchParams;
    return <SignInGate returnTo="/" error={signInErrorMessage(error)} />;
  }

  return <Lobbies lobbies={await listMyLobbies(me.id)} />;
}
