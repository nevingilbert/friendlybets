import { SignInButton } from "@/components/sign-in-button";

const HIGHLIGHTS = [
  ["Start a lobby", "One tap. You get a six-character code and a link."],
  ["Share the link", "Friends join from their phone — no install, no account setup."],
  ["Bet on anything", "Freeform stakes. A shot, the dishes, bragging rights."],
] as const;

/** Auth.js error codes that come back in ?error=, translated for a guest. */
const SIGN_IN_ERRORS: Record<string, string> = {
  Configuration: "Google sign-in is not set up correctly on the server. Ask the host to check the deployment.",
  AccessDenied: "Google did not let that account sign in.",
  Verification: "That sign-in link has expired. Try again.",
  OAuthSignin: "Could not start the Google sign-in. Try again.",
  OAuthCallback: "Google sign-in did not finish. Try again.",
  OAuthCallbackError: "Google sign-in did not finish. Try again.",
  CallbackRouteError: "Signing you in failed on our side. Try again in a moment.",
};

export function signInErrorMessage(code: string | string[] | undefined): string | null {
  if (!code) return null;
  const key = Array.isArray(code) ? code[0] : code;
  return SIGN_IN_ERRORS[key] ?? "Sign-in did not work. Try again.";
}

/**
 * Rendered *in place* on any page that needs a session rather than redirecting, so the
 * URL is still the page the guest wanted and Google sends them straight back to it.
 */
export function SignInGate({ returnTo = "/", error }: { returnTo?: string; error?: string | null }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-10 px-6 py-16">
      <header className="animate-fade-up">
        <p className="mb-3 text-sm font-semibold tracking-widest text-emerald-400 uppercase">FriendlyBets</p>
        <h1 className="text-4xl leading-tight font-extrabold text-balance text-zinc-50">Bet your friends on anything.</h1>
        <p className="mt-3 text-base leading-relaxed text-zinc-400">
          Create a lobby, send the link, and settle it on the honour system. Nothing to install.
        </p>
      </header>

      <ul className="animate-fade-up flex flex-col gap-4">
        {HIGHLIGHTS.map(([title, body], index) => (
          <li key={title} className="flex gap-3.5">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-bold text-emerald-300">
              {index + 1}
            </span>
            <div>
              <p className="text-sm font-semibold text-zinc-200">{title}</p>
              <p className="text-sm text-zinc-500">{body}</p>
            </div>
          </li>
        ))}
      </ul>

      <SignInButton redirectTo={returnTo} error={error} />
    </main>
  );
}
