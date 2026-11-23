"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { icons } from "@/components/icons";
import { useMe } from "@/components/me-context";
import { Avatar } from "@/components/ui";
import { signOutAction } from "@/server/actions";

const ICON_BUTTON =
  "flex h-11 w-11 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400";

export function TopBar({
  title,
  subtitle,
  backTo,
  actions,
}: {
  title: string;
  subtitle?: string | null;
  backTo?: string;
  actions?: ReactNode;
}) {
  const me = useMe();

  return (
    <header className="safe-top sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-2xl items-center gap-3 px-4">
        {backTo && (
          <Link href={backTo} aria-label="Back" className={`-ml-2 shrink-0 ${ICON_BUTTON}`}>
            {icons.back}
          </Link>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-zinc-100">{title}</p>
          {subtitle && <p className="truncate text-xs text-zinc-500">{subtitle}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {actions}
          {me && (
            <form action={signOutAction}>
              <button
                type="submit"
                title={`Signed in as ${me.display_name} — sign out`}
                aria-label={`Sign out ${me.display_name}`}
                className="flex h-11 w-11 items-center justify-center rounded-full transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
              >
                <Avatar name={me.display_name} url={me.avatar_url} size="sm" />
              </button>
            </form>
          )}
        </div>
      </div>
    </header>
  );
}

export function IconButton({
  label,
  onClick,
  href,
  children,
}: {
  label: string;
  onClick?: () => void;
  href?: string;
  children: ReactNode;
}) {
  if (href) {
    return (
      <Link href={href} aria-label={label} title={label} className={ICON_BUTTON}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={ICON_BUTTON}>
      {children}
    </button>
  );
}
