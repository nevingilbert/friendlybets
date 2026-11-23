import type { ActionResult } from "@/lib/types";

/** Unwraps a Server Action result so call sites can use plain try/catch. */
export async function unwrap<T>(result: Promise<ActionResult<T>>): Promise<T> {
  const settled = await result;
  if (!settled.ok) throw new Error(settled.error);
  return settled.data;
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}
