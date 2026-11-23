#!/usr/bin/env node
/**
 * One-off: copy users, lobbies, memberships and bets out of the old Supabase project.
 *
 *   npm run db:import-supabase -- path/to/backup.sql[.gz]           dry run: counts only
 *   npm run db:import-supabase -- path/to/backup.sql[.gz] --write   actually import
 *
 * Get the backup from the Supabase dashboard (the paused project's page offers a
 * download, or Database → Backups). Run `npm run db:migrate` against Neon first.
 *
 * Everything is written in one transaction, so a failure leaves Neon untouched, and
 * re-running is a no-op for rows that already arrived.
 */

import { connect, fail } from "./lib/db.mjs";
import { DUMP_TABLES, parseCopyBlocks, readDump, shapeImport, writeImport } from "./lib/supabase-dump.mjs";

const file = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
const write = process.argv.includes("--write");

if (!file) fail("Pass the path to the Supabase backup: npm run db:import-supabase -- backup.sql.gz");

let data;
try {
  data = shapeImport(parseCopyBlocks(readDump(file), DUMP_TABLES));
} catch (error) {
  fail(error.message);
}

console.log("Found in the backup:");
console.log(`  users    ${data.users.length}  (${data.users.filter((u) => u.google_sub).length} with a Google id)`);
console.log(`  lobbies  ${data.lobbies.length}`);
console.log(`  members  ${data.members.length}`);
console.log(`  bets     ${data.bets.length}`);

if (data.users.length === 0) {
  fail("No public.profiles rows in that file — is it the friendlybets backup, and does it include data?");
}

if (data.unmatched.length > 0) {
  console.warn(
    `\n! ${data.unmatched.length} user(s) have neither a Google id nor an email in the backup ` +
      `(${data.unmatched.join(", ")}). Their history imports, but signing in will create a ` +
      "new account rather than reclaim it. A backup that includes the auth schema avoids this.",
  );
}

if (!write) {
  console.log("\nDry run — nothing written. Re-run with --write to import.");
  process.exit(0);
}

const sql = connect({ direct: true });

try {
  const counts = await sql.begin((tx) => writeImport((text, params) => tx.unsafe(text, params), data));
  console.log("\n✓ Imported (new rows):");
  for (const [table, count] of Object.entries(counts)) console.log(`  ${table.padEnd(8)} ${count}`);
} catch (error) {
  fail(`Import failed and was rolled back:\n  ${error.message}`);
} finally {
  await sql.end({ timeout: 5 });
}
