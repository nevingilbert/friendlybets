import type { BetStatus } from "@/lib/types";

export const STATUS_LABEL: Record<BetStatus, string> = {
  OPEN: "Open",
  ACCEPTED: "Locked in",
  RESOLVED: "Awaiting payment",
  COMPLETED: "Settled",
  CANCELLED: "Cancelled",
};

export const STATUS_STYLE: Record<BetStatus, string> = {
  OPEN: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  ACCEPTED: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  RESOLVED: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  COMPLETED: "bg-zinc-500/15 text-zinc-400 ring-zinc-500/30",
  CANCELLED: "bg-zinc-500/10 text-zinc-500 ring-zinc-600/30",
};

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatRelative(value: string | null | undefined, now: number = Date.now()): string {
  if (!value) return "";
  const seconds = Math.round((now - new Date(value).getTime()) / 1000);
  if (seconds < 45) return "just now";

  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ["minute", 60],
    ["hour", 60],
    ["day", 24],
  ];
  let amount = seconds / 60;
  let unit: Intl.RelativeTimeFormatUnit = "minute";
  for (let i = 0; i < steps.length - 1; i += 1) {
    if (Math.abs(amount) < steps[i + 1][1]) break;
    amount /= steps[i + 1][1];
    unit = steps[i + 1][0];
  }
  return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(-Math.round(amount), unit);
}

export function initialsOf(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

/** Stable per-name accent so the same person keeps the same colour everywhere. */
export function avatarTone(name: string | null | undefined): string {
  const tones = [
    "bg-emerald-500/20 text-emerald-300",
    "bg-sky-500/20 text-sky-300",
    "bg-violet-500/20 text-violet-300",
    "bg-amber-500/20 text-amber-300",
    "bg-rose-500/20 text-rose-300",
    "bg-teal-500/20 text-teal-300",
  ];
  const text = name ?? "";
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return tones[hash % tones.length];
}
