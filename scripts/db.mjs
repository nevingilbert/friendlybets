#!/usr/bin/env node
/**
 * Schema tooling. No external migration framework — the schema is a handful of files.
 *
 *   npm run db:migrate          apply anything in db/migrations that has not run yet
 *   npm run db:status           show applied migrations and row counts
 *   npm run db:reset -- --yes   DROP the public schema, then migrate
 *
 * Each migration file is sent as one multi-statement simple query, which Postgres runs
 * as a single implicit transaction: a file either applies completely or not at all.
 * Applied versions are recorded in schema_migrations, so re-running is a no-op.
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { connect, fail } from "./lib/db.mjs";

const MIGRATIONS_DIR = path.resolve(process.cwd(), "db/migrations");

const command = process.argv[2] ?? "migrate";
const confirmed = process.argv.includes("--yes");

const sql = connect({ direct: true });

async function ensureMigrationsTable() {
  await sql`
    create table if not exists public.schema_migrations (
      version    text primary key,
      applied_at timestamptz not null default now()
    )
  `;
}

function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

async function migrate() {
  await ensureMigrationsTable();

  const applied = new Set(
    (await sql`select version from public.schema_migrations`).map((row) => row.version),
  );

  let count = 0;

  for (const file of migrationFiles()) {
    if (applied.has(file)) {
      console.log(`• ${file} (already applied)`);
      continue;
    }

    const contents = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");

    try {
      await sql.unsafe(contents);
      await sql`insert into public.schema_migrations (version) values (${file})`;
      console.log(`✓ ${file}`);
      count += 1;
    } catch (error) {
      fail(`${file} failed to apply:\n  ${error.message}`);
    }
  }

  console.log(
    count === 0 ? "\nAlready up to date." : `\nApplied ${count} migration${count === 1 ? "" : "s"}.`,
  );
}

async function status() {
  const [{ exists }] = await sql`
    select exists (
      select 1 from information_schema.tables
       where table_schema = 'public' and table_name = 'schema_migrations'
    ) as exists
  `;

  if (!exists) {
    console.log("No migrations have been applied. Run `npm run db:migrate`.");
    return;
  }

  const rows = await sql`
    select version, applied_at from public.schema_migrations order by version
  `;

  console.log("Applied migrations:");
  for (const row of rows) {
    console.log(`  ${row.version}  ${row.applied_at.toISOString()}`);
  }

  const pending = migrationFiles().filter((f) => !rows.some((r) => r.version === f));
  if (pending.length > 0) {
    console.log("\nPending:");
    for (const file of pending) console.log(`  ${file}`);
  }

  const counts = await sql`
    select
      (select count(*) from public.users)         as users,
      (select count(*) from public.lobbies)       as lobbies,
      (select count(*) from public.lobby_members) as members,
      (select count(*) from public.bets)          as bets
  `;

  console.log("\nRows:");
  for (const [table, value] of Object.entries(counts[0])) {
    console.log(`  ${table.padEnd(9)} ${value}`);
  }
}

async function reset() {
  if (!confirmed) {
    fail("This DROPS every table. Re-run as `npm run db:reset -- --yes` if you mean it.");
  }

  await sql.unsafe("drop schema public cascade; create schema public;");
  console.log("✓ public schema dropped and recreated");
  await migrate();
}

try {
  switch (command) {
    case "migrate":
      await migrate();
      break;
    case "status":
      await status();
      break;
    case "reset":
      await reset();
      break;
    default:
      fail(`Unknown command "${command}". Try migrate, status or reset.`);
  }
} finally {
  await sql.end({ timeout: 5 });
}
