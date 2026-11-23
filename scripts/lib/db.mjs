/**
 * Connection helper shared by the schema scripts.
 *
 * Kept separate from src/lib/db so the scripts can run under plain node without
 * dragging the Next.js module graph (and `server-only`) along with them.
 */

import { config } from "dotenv";
import postgres from "postgres";

// .env.local wins, matching what `next dev` reads.
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

export function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

/**
 * `direct: true` prefers the unpooled connection string. Neon recommends it for DDL
 * — a pooled endpoint can route consecutive statements to different sessions, which
 * is exactly what a migration must not do.
 */
export function connect({ direct = false } = {}) {
  const url = direct
    ? process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
    : process.env.DATABASE_URL;

  if (!url) {
    fail(
      "DATABASE_URL is not set. Copy .env.example to .env.local and paste your Neon connection string.",
    );
  }

  return postgres(url, {
    max: 1,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 20,
    onnotice: () => {},
  });
}
