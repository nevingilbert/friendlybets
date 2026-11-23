import { z } from "zod";

/**
 * Shapes checked at the trust boundary — a Server Action can be called with anything.
 * The database re-checks all of it; this is what turns garbage into a readable
 * message instead of a Postgres cast error.
 */

export const uuidSchema = z.uuid();
export const sideSchema = z.enum(["YES", "NO"]);
export const lobbyStatusSchema = z.enum(["OPEN", "LOCKED", "ARCHIVED"]);
export const joinCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6}$/, "Codes are six characters.");

export const lobbyNameSchema = z.string().trim().min(1, "Give your lobby a name.").max(60);
export const displayNameSchema = z.string().trim().min(1, "Your name cannot be empty.").max(40);

export const newBetSchema = z.object({
  proposition: z.string().trim().min(1, "What are you betting on?").max(280),
  stake: z.string().trim().min(1, "What's on the line?").max(120),
  side: sideSchema,
});

export function isUuid(value: unknown): value is string {
  return uuidSchema.safeParse(value).success;
}
