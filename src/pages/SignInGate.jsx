import { SignInButton } from '../components/SignInButton'

const HIGHLIGHTS = [
  ['Start a lobby', 'One tap. You get a six-character code and a link.'],
  ['Share the link', 'Friends join from their phone — no install, no account setup.'],
  ['Bet on anything', 'Freeform stakes. A shot, the dishes, bragging rights.'],
]

export default function SignInGate({ headline, subhead }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-10 px-6 py-16">
      <header className="animate-fade-up">
        <p className="mb-3 text-sm font-semibold tracking-widest text-emerald-400 uppercase">
          FriendlyBets
        </p>
        <h1 className="text-4xl leading-tight font-extrabold text-balance text-zinc-50">
          {headline ?? 'Bet your friends on anything.'}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-zinc-400">
          {subhead ??
            'Create a lobby, send the link, and settle it on the honour system. Nothing to install.'}
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

      <SignInButton />
    </main>
  )
}
