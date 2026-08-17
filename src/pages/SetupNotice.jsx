/**
 * Shown when VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY are missing, which
 * is the one failure a fresh clone will actually hit.
 */
export default function SetupNotice() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-5 px-6 py-16">
      <h1 className="text-2xl font-bold text-zinc-100">FriendlyBets needs configuring</h1>
      <p className="text-sm leading-relaxed text-zinc-400">
        The app could not find its Supabase credentials. Copy{' '}
        <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-200">.env.example</code> to{' '}
        <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-200">.env.local</code>, fill in
        both values, then restart the dev server.
      </p>
      <pre className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-xs text-zinc-300">
{`VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...`}
      </pre>
      <p className="text-sm text-zinc-500">
        Deploying instead? Set the same two variables on your Vercel project and redeploy. See{' '}
        <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-200">docs/DEPLOYMENT.md</code>.
      </p>
    </main>
  )
}
