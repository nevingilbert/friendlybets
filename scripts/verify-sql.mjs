#!/usr/bin/env node
/**
 * Verifies the schema, the write API and the Supabase import against real Postgres.
 *
 *   npm run test:sql
 *
 * Runs db/migrations/*.sql against PGlite — actual Postgres compiled to WebAssembly —
 * then plays a lobby through every function, including each guard that is supposed
 * to refuse something, and finally imports a synthetic Supabase backup.
 *
 * No Docker, no Neon project and no network, so it runs in `npm run verify`.
 */
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

import { parseCopyBlocks, DUMP_TABLES, shapeImport, writeImport } from "./lib/supabase-dump.mjs";

const report = (error) => {
  console.error(`\n✖ ${error?.message ?? error}`);
  if (error?.where) console.error(`  in: ${error.where}`);
  process.exit(1);
};
process.on("unhandledRejection", report);
process.on("uncaughtException", report);

const ok = (m) => console.log(`  ✓ ${m}`);
const section = (m) => console.log(`\n${m}`);

async function freshDb() {
  const db = await new PGlite();
  for (const file of readdirSync("db/migrations").filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(`db/migrations/${file}`, "utf8"));
  }
  return db;
}

const db = await freshDb();

async function one(sql, params) {
  return (await db.query(sql, params)).rows[0];
}

async function refuses(label, sql, params, pattern) {
  try {
    await db.query(sql, params);
  } catch (error) {
    if (pattern && !pattern.test(error.message)) {
      throw new Error(`${label}: refused, but with "${error.message}"`);
    }
    ok(`refuses: ${label}`);
    return;
  }
  throw new Error(`${label}: was allowed`);
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
  ok(message);
}

section("Migrations");
ok("db/migrations applied");

section("Sign-in");
const ana = (await one(`select public.upsert_user($1,$2,$3,$4) as r`, ["g-ana", "Ana@X.com", "Ana Smith", null])).r.user_id;
const ben = (await one(`select public.upsert_user($1,$2,$3,$4) as r`, ["g-ben", "ben@x.com", "Ben", null])).r.user_id;
const cat = (await one(`select public.upsert_user($1,$2,$3,$4) as r`, ["g-cat", "cat@x.com", "", null])).r.user_id;
expect((await one(`select display_name from users where id=$1`, [cat])).display_name === "cat", "empty name falls back to the email");
const again = (await one(`select public.upsert_user($1,$2,$3,$4) as r`, ["g-ana", "ana@x.com", "Ana", "pic"])).r.user_id;
expect(again === ana, "a returning user keeps their id");
await one(`select public.rename_user($1,$2)`, [ana, "Ana"]);
await one(`select public.upsert_user($1,$2,$3,$4)`, ["g-ana", "ana@x.com", "Ana Smith", null]);
expect((await one(`select display_name from users where id=$1`, [ana])).display_name === "Ana", "signing in again does not undo a rename");
await refuses("rename to nothing", `select public.rename_user($1,$2)`, [ana, "  "], /empty/);

section("Lobbies");
const lobby = await one(`select * from public.create_lobby($1,$2)`, [ana, "Game night"]);
expect(/^[A-HJ-NP-Z2-9]{6}$/.test(lobby.code), "lobby code avoids ambiguous glyphs");
await refuses("create without a session", `select public.create_lobby($1,$2)`, [null, "x"], /signed in/);
const preview = await one(`select * from public.lobby_preview($1)`, [lobby.code.toLowerCase()]);
expect(preview.host_name === "Ana" && Number(preview.member_count) === 1, "preview works by code, case-insensitively");
await one(`select public.join_lobby($1,$2)`, [ben, lobby.code]);
await one(`select public.join_lobby($1,$2)`, [ben, lobby.code]);
expect(Number((await one(`select count(*) n from lobby_members where lobby_id=$1`, [lobby.id])).n) === 2, "joining twice is a no-op");
await refuses("non-host renames lobby", `select public.update_lobby($1,$2,$3,null)`, [ben, lobby.id, "x"], /host/);
await one(`select public.update_lobby($1,$2,null,'LOCKED')`, [ana, lobby.id]);
await refuses("join a locked lobby", `select public.join_lobby($1,$2)`, [cat, lobby.code], /closed/);
await one(`select public.join_lobby($1,$2)`, [ben, lobby.code]);
ok("an existing member can still re-enter a locked lobby");
await one(`select public.update_lobby($1,$2,null,'OPEN')`, [ana, lobby.id]);
await one(`select public.join_lobby($1,$2)`, [cat, lobby.code]);
await refuses("host leaves", `select public.leave_lobby($1,$2)`, [ana, lobby.id], /host/);
await refuses("non-host removes", `select public.remove_member($1,$2,$3)`, [ben, lobby.id, cat], /host/);

section("Bets");
await refuses("stranger posts", `select public.create_bet($1,$2,'x','y','YES')`, [
  (await one(`select public.upsert_user('g-zed','zed@x.com','Zed',null) as r`)).r.user_id, lobby.id,
], /not in this lobby/);
const bet = await one(`select * from public.create_bet($1,$2,$3,$4,$5)`, [ana, lobby.id, "It rains", "A shot", "YES"]);
await refuses("accept your own bet", `select public.accept_bet($1,$2)`, [ana, bet.id], /own bet/);
await refuses("stranger resolves an open bet", `select public.resolve_bet($1,$2,'YES')`, [cat, bet.id], /two people/);
await one(`select public.accept_bet($1,$2)`, [ben, bet.id]);
await refuses("second accept", `select public.accept_bet($1,$2)`, [cat, bet.id], /already took/);
await refuses("third party resolves", `select public.resolve_bet($1,$2,'YES')`, [cat, bet.id], /two people/);
await refuses("cancel an accepted bet", `select public.cancel_bet($1,$2)`, [ana, bet.id], /creator/);
const resolved = await one(`select * from public.resolve_bet($1,$2,'NO')`, [ben, bet.id]);
expect(resolved.winner_id === ben && resolved.loser_id === ana, "NO on a creator's YES makes the acceptor the winner");
await one(`select public.complete_bet($1,$2)`, [ana, bet.id]);
const board = (await db.query(`select * from public.lobby_leaderboard($1)`, [lobby.id])).rows;
expect(board[0].user_id === ben && Number(board[0].wins) === 1, "leaderboard ranks the winner first");

const bet2 = await one(`select * from public.create_bet($1,$2,'x','y','NO')`, [ben, lobby.id]);
await one(`select public.accept_bet($1,$2)`, [cat, bet2.id]);
await one(`select public.host_undo_accept($1,$2)`, [ana, bet2.id]);
expect((await one(`select status, acceptor_id from bets where id=$1`, [bet2.id])).acceptor_id === null, "host can reopen an accepted bet");
await refuses("non-host deletes", `select public.host_delete_bet($1,$2)`, [ben, bet2.id], /host/);
await one(`select public.cancel_bet($1,$2)`, [ben, bet2.id]);
await one(`select public.host_delete_bet($1,$2)`, [ana, bet2.id]);
ok("host deletes a bet");

section("Reads");
const snap = (await one(`select public.lobby_snapshot($1,$2) as s`, [lobby.id, ben])).s;
expect(snap.members.length === 3 && snap.bets.length === 1 && snap.leaderboard.length === 3, "snapshot has members, bets and leaderboard");
expect(snap.names[ana] === "Ana", "snapshot names everyone a bet mentions");
const zed = (await one(`select id from users where google_sub='g-zed'`)).id;
expect((await one(`select public.lobby_snapshot($1,$2) as s`, [lobby.id, zed])).s === null, "snapshot is null for a non-member");
await one(`select public.remove_member($1,$2,$3)`, [ana, lobby.id, cat]);
expect((await one(`select public.lobby_snapshot($1,$2) as s`, [lobby.id, cat])).s === null, "a removed player loses access");
expect((await db.query(`select * from public.my_lobbies($1)`, [ben])).rows.length === 1, "my_lobbies lists the lobbies you are in");

section("Supabase import");
const P1 = "11111111-1111-1111-1111-111111111111";
const P2 = "22222222-2222-2222-2222-222222222222";
const L1 = "33333333-3333-3333-3333-333333333333";
const B1 = "44444444-4444-4444-4444-444444444444";
const dump = [
  "-- PostgreSQL database dump",
  "COPY auth.users (instance_id, id, aud, email, raw_user_meta_data) FROM stdin;",
  `\\N\t${P1}\tauthenticated\tdee@x.com\t{}`,
  `\\N\t${P2}\tauthenticated\tBen@X.com\t{}`,
  "\\.",
  "COPY auth.identities (provider_id, user_id, identity_data, provider, id) FROM stdin;",
  `g-dee\t${P1}\t{"sub": "g-dee"}\tgoogle\t${P1}`,
  `g-ben\t${P2}\t{"sub": "g-ben"}\tgoogle\t${P2}`,
  "\\.",
  "COPY public.profiles (id, display_name, avatar_url, created_at) FROM stdin;",
  `${P1}\tDee\\tTab\t\\N\t2026-08-20 10:00:00+00`,
  `${P2}\tBenjamin\t\\N\t2026-08-20 10:00:00+00`,
  "\\.",
  "COPY public.lobbies (id, code, name, host_id, status, created_at) FROM stdin;",
  `${L1}\tABCDEF\tOld lobby\t${P1}\tOPEN\t2026-08-20 10:01:00+00`,
  "\\.",
  "COPY public.lobby_members (lobby_id, user_id, role, joined_at) FROM stdin;",
  `${L1}\t${P1}\tHOST\t2026-08-20 10:01:00+00`,
  `${L1}\t${P2}\tMEMBER\t2026-08-20 10:02:00+00`,
  "\\.",
  "COPY public.bets (id, lobby_id, proposition, stake, creator_id, creator_side, acceptor_id, status, outcome, winner_id, loser_id, created_at, accepted_at, resolved_at, completed_at) FROM stdin;",
  `${B1}\t${L1}\tLine one\\nline two\tA shot\t${P1}\tYES\t${P2}\tRESOLVED\tYES\t${P1}\t${P2}\t2026-08-20 10:03:00+00\t2026-08-20 10:04:00+00\t2026-08-20 10:05:00+00\t\\N`,
  "\\.",
].join("\n");

const data = shapeImport(parseCopyBlocks(dump, DUMP_TABLES));
expect(data.users.length === 2 && data.users[0].google_sub === "g-dee", "parser joins profiles to Google ids");
expect(data.users[0].display_name === "Dee\tTab" && data.bets[0].proposition === "Line one\nline two", "COPY escapes are decoded");

// Ben already signed in to the new app (as `ben`, id differs from P2) before the import.
const counts = await db.transaction((tx) => writeImport(async (t, p) => (await tx.query(t, p)).rows, data));
expect(counts.users === 1 && counts.lobbies === 1 && counts.members === 2 && counts.bets === 1, "import writes the new rows");
const importedBet = await one(`select * from bets where id=$1`, [B1]);
expect(importedBet.acceptor_id === ben && importedBet.loser_id === ben, "an imported user who already signed in is re-pointed to their new id");
const dee = (await one(`select public.upsert_user('g-dee','dee@x.com','Dee New',null) as r`)).r.user_id;
expect(dee === P1, "an imported user signing in for the first time reclaims their history");
const again2 = await db.transaction((tx) => writeImport(async (t, p) => (await tx.query(t, p)).rows, data));
expect(Object.values(again2).every((n) => n === 0), "re-running the import is a no-op");
expect((await one(`select public.lobby_snapshot($1,$2) as s`, [L1, ben])).s.bets.length === 1, "imported lobby is readable by its members");

console.log("\nAll SQL checks passed.");
