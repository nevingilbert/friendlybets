"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * This site's origin, for building invite links. Empty during server rendering — the
 * same code then works on localhost, a Vercel preview and production with no config.
 */
export function useOrigin(): string {
  return useSyncExternalStore(
    subscribe,
    () => window.location.origin,
    () => "",
  );
}

export function inviteUrlFor(origin: string, code: string): string {
  return `${origin}/join/${code}`;
}
