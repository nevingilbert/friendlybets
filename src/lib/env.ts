/**
 * Environment access in one place.
 *
 * Everything here is server-only: the browser never talks to Postgres and never sees
 * an OAuth secret.
 */

/** Pooled connection string used by the app at runtime. */
export function getDatabaseUrl(): string | null {
  return process.env.DATABASE_URL || null;
}

export function isDatabaseConfigured(): boolean {
  return getDatabaseUrl() !== null;
}

/** True once a Google OAuth client has been configured for sign-in. */
export function isGoogleAuthConfigured(): boolean {
  return Boolean(getGoogleClientId() && getGoogleClientSecret());
}

export function getGoogleClientId(): string {
  return process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID || "";
}

export function getGoogleClientSecret(): string {
  return process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET || "";
}

/**
 * True once Auth.js has a signing secret. Without it Auth.js refuses to mint a session
 * at all, so it is named in the setup notice rather than left to a sign-in button that
 * silently bounces.
 */
export function isSessionSecretConfigured(): boolean {
  return Boolean(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET);
}

/** Every variable the app cannot run without, by name, for the setup notice. */
export function missingConfiguration(): string[] {
  const missing: string[] = [];
  if (!isDatabaseConfigured()) missing.push("DATABASE_URL");
  if (!isGoogleAuthConfigured()) missing.push("AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET");
  if (!isSessionSecretConfigured()) missing.push("AUTH_SECRET");
  return missing;
}
