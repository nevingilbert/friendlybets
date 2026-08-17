import { Link } from 'react-router-dom'
import { useAuth } from '../context/auth'
import { icons } from './icons'
import { Avatar } from './ui'

export function TopBar({ title, subtitle, backTo, actions }) {
  const { profile, signOut } = useAuth()

  return (
    <header className="safe-top sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-2xl items-center gap-3 px-4">
        {backTo && (
          <Link
            to={backTo}
            aria-label="Back"
            className="-ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            {icons.back}
          </Link>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-zinc-100">{title}</p>
          {subtitle && <p className="truncate text-xs text-zinc-500">{subtitle}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {actions}
          {profile && (
            <button
              onClick={signOut}
              title={`Signed in as ${profile.display_name} — sign out`}
              className="rounded-full transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            >
              <Avatar name={profile.display_name} url={profile.avatar_url} size="sm" />
            </button>
          )}
        </div>
      </div>
    </header>
  )
}

export function IconButton({ label, onClick, to, children }) {
  const className =
    'flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100'
  if (to) {
    return (
      <Link to={to} aria-label={label} title={label} className={className}>
        {children}
      </Link>
    )
  }
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={className}>
      {children}
    </button>
  )
}
