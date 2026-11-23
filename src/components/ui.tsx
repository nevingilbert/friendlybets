"use client";

import {
  useEffect,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";

import { avatarTone, initialsOf, STATUS_LABEL, STATUS_STYLE } from "@/lib/format";
import type { BetStatus, Side } from "@/lib/types";

/**
 * FriendlyBets' own primitives. Flat zinc surfaces, hairline rings, and one semantic
 * pair — emerald for YES, rose for NO — doing all the work.
 */

const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400";

const BUTTON_VARIANTS = {
  primary: "bg-emerald-500 text-emerald-950 hover:bg-emerald-400 active:bg-emerald-600",
  secondary: "bg-zinc-800 text-zinc-100 hover:bg-zinc-700 ring-1 ring-zinc-700",
  ghost: "bg-transparent text-zinc-300 hover:bg-zinc-800/70",
  danger: "bg-rose-600 text-white hover:bg-rose-500",
} as const;

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BUTTON_VARIANTS }) {
  return (
    <button
      type={type}
      {...props}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold
        transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}
        ${BUTTON_VARIANTS[variant]} ${className}`}
    />
  );
}

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`rounded-2xl border border-zinc-800 bg-zinc-900/70 ${className}`} />;
}

export function StatusPill({ status, className = "" }: { status: BetStatus; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold
        ring-1 ring-inset ${STATUS_STYLE[status] ?? STATUS_STYLE.CANCELLED} ${className}`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function SidePill({ side, className = "" }: { side: Side; className?: string }) {
  const tone =
    side === "YES"
      ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
      : "bg-rose-500/15 text-rose-300 ring-rose-500/30";
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold ring-1 ring-inset ${tone} ${className}`}
    >
      {side}
    </span>
  );
}

const AVATAR_SIZES = {
  sm: "h-7 w-7 text-[11px]",
  md: "h-9 w-9 text-xs",
  lg: "h-12 w-12 text-sm",
  xl: "h-16 w-16 text-lg",
} as const;

export function Avatar({
  name,
  url,
  size = "md",
  className = "",
}: {
  name: string | null | undefined;
  url?: string | null;
  size?: keyof typeof AVATAR_SIZES;
  className?: string;
}) {
  const base = `inline-flex shrink-0 items-center justify-center rounded-full font-bold ${AVATAR_SIZES[size]} ${className}`;

  if (url) {
    return (
      // Google-hosted profile pictures; next/image would need every avatar host allow-listed.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" referrerPolicy="no-referrer" className={`${base} object-cover ring-1 ring-zinc-700`} />
    );
  }
  return <span className={`${base} ${avatarTone(name)}`}>{initialsOf(name)}</span>;
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent ${className}`}
    />
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <p className="text-lg font-semibold text-zinc-300">{title}</p>
      {hint && <p className="max-w-sm text-sm text-zinc-500">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-zinc-300">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

// 16px text on inputs is what stops iOS zooming the page on focus.
const INPUT_BASE = `w-full rounded-xl border border-zinc-700 bg-zinc-950/60 px-3.5 py-3 text-base
  text-zinc-100 placeholder-zinc-600 transition-colors
  focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500`;

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${INPUT_BASE} ${className}`} />;
}

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${INPUT_BASE} resize-none ${className}`} />;
}

const ALERT_TONES = {
  error: "border-rose-500/40 bg-rose-500/10 text-rose-200",
  success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  info: "border-sky-500/40 bg-sky-500/10 text-sky-200",
} as const;

export function Alert({ tone = "error", children }: { tone?: keyof typeof ALERT_TONES; children: ReactNode }) {
  if (!children) return null;
  return (
    <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${ALERT_TONES[tone]}`}>
      {children}
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="safe-bottom animate-pop w-full max-w-md rounded-t-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl sm:rounded-3xl"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="text-lg font-bold text-zinc-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`-m-2 flex h-11 w-11 items-center justify-center rounded-lg text-2xl leading-none text-zinc-500 hover:text-zinc-200 ${FOCUS}`}
          >
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function GoogleButton({
  children = "Continue with Google",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-white px-4
        text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-200
        disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS}`}
    >
      <svg viewBox="0 0 18 18" aria-hidden="true" className="h-5 w-5">
        <path
          fill="#4285F4"
          d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62Z"
        />
        <path
          fill="#34A853"
          d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.35 0-4.34-1.58-5.05-3.71H.96v2.33A9 9 0 0 0 9 18Z"
        />
        <path fill="#FBBC05" d="M3.95 10.71a5.4 5.4 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l2.99-2.33Z" />
        <path
          fill="#EA4335"
          d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l2.99 2.33C4.66 5.16 6.65 3.58 9 3.58Z"
        />
      </svg>
      {children}
    </button>
  );
}
