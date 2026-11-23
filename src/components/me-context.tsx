"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { Me } from "@/lib/types";

const MeContext = createContext<Me | null>(null);

/**
 * The signed-in person, read once on the server by the root layout and handed down.
 * Renaming yourself revalidates the layout, which re-renders this with the new name.
 */
export function MeProvider({ me, children }: { me: Me | null; children: ReactNode }) {
  return <MeContext.Provider value={me}>{children}</MeContext.Provider>;
}

export function useMe(): Me | null {
  return useContext(MeContext);
}
