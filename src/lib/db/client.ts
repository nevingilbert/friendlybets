import "server-only";

import postgres, { type Sql } from "postgres";

import { getDatabaseUrl } from "@/lib/env";

/**
 * The one and only database connection.
 *
 * Server-only by construction: `server-only` above turns an import from a client
 * component into a build error, so the connection string can never reach the browser.
 *
 * Tuned for serverless (Vercel functions, Neon):
 *   * max: 1         — each function instance keeps a single connection
 *   * prepare: false  — required when talking to a pooled/pgbouncer endpoint
 *   * idle_timeout    — let the connection (and a scale-to-zero database) go to sleep
 *
 * Cached on globalThis so `next dev` hot reloads do not open a new pool each time.
 */
const globalForDb = globalThis as unknown as { friendlyBetsSql?: Sql };

export function getSql(): Sql | null {
  const url = getDatabaseUrl();
  if (!url) return null;

  if (!globalForDb.friendlyBetsSql) {
    globalForDb.friendlyBetsSql = postgres(url, {
      max: 1,
      prepare: false,
      idle_timeout: 20,
      connect_timeout: 15,
      onnotice: () => {},
    });
  }

  return globalForDb.friendlyBetsSql;
}

/** Thrown when the app is running without DATABASE_URL configured. */
export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("DATABASE_URL is not set, so the database is unreachable.");
    this.name = "DatabaseNotConfiguredError";
  }
}

export function requireSql(): Sql {
  const sql = getSql();
  if (!sql) throw new DatabaseNotConfiguredError();
  return sql;
}
