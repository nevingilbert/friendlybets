/**
 * Says out loud when the app is running half-configured. The failure without this is
 * baffling — a sign-in button that bounces straight back — and the fix is always one
 * environment variable.
 */
export function SetupNotice({ missing }: { missing: string[] }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-6 py-16">
      <p className="text-sm font-semibold tracking-widest text-emerald-400 uppercase">FriendlyBets</p>
      <h1 className="text-2xl font-bold text-zinc-50">Not finished setting up</h1>
      <p className="text-zinc-400">
        The server is missing <span className="font-mono text-zinc-200">{missing.join(", ")}</span>. Copy{" "}
        <code className="text-zinc-200">.env.example</code> to <code className="text-zinc-200">.env.local</code> (or set
        them in the Vercel project), then restart. See <code className="text-zinc-200">docs/DEPLOYMENT.md</code>.
      </p>
    </main>
  );
}
