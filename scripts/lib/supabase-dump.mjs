/**
 * Reads the rows FriendlyBets needs out of a Supabase backup, and writes them into
 * the Neon schema.
 *
 * A Supabase backup is a plain-SQL pg_dump (optionally gzipped). Table data in it is
 * `COPY schema.table (cols) FROM stdin;` followed by tab-separated rows and a `\.`
 * terminator. Parsing that directly means the import needs no psql, no Docker and no
 * scratch Postgres to restore into — just the file.
 *
 * Kept free of any database driver so it can be exercised end to end against PGlite
 * in `npm run test:sql`.
 */

import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

/** Returns the dump as text, gunzipping if needed. Throws on a custom-format dump. */
export function readDump(path) {
  let bytes = readFileSync(path);

  if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = gunzipSync(bytes);

  if (bytes.subarray(0, 5).toString("latin1") === "PGDMP") {
    throw new Error(
      "This is a custom-format (binary) pg_dump. Convert it to plain SQL first:\n" +
        `  pg_restore --data-only -f backup.sql "${path}"\n` +
        "then run the import against backup.sql.",
    );
  }

  return bytes.toString("utf8");
}

/** Decodes one field of COPY text format. */
export function decodeCopyField(raw) {
  if (raw === "\\N") return null;
  if (!raw.includes("\\")) return raw;

  let out = "";
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch !== "\\") {
      out += ch;
      continue;
    }

    const next = raw[i + 1];
    i += 1;
    switch (next) {
      case "b": out += "\b"; break;
      case "f": out += "\f"; break;
      case "n": out += "\n"; break;
      case "r": out += "\r"; break;
      case "t": out += "\t"; break;
      case "v": out += "\v"; break;
      case "x": {
        const hex = raw.slice(i + 1, i + 3).match(/^[0-9a-fA-F]{1,2}/)?.[0] ?? "";
        out += String.fromCharCode(Number.parseInt(hex || "0", 16));
        i += hex.length;
        break;
      }
      default:
        if (next >= "0" && next <= "7") {
          const oct = raw.slice(i, i + 3).match(/^[0-7]{1,3}/)[0];
          out += String.fromCharCode(Number.parseInt(oct, 8));
          i += oct.length - 1;
        } else {
          // `\\` and any other escaped character stand for themselves.
          out += next ?? "";
        }
    }
  }
  return out;
}

const unquote = (name) => name.replace(/^"(.*)"$/, "$1");

/**
 * Pulls the COPY blocks for the named tables out of the dump.
 * Returns { "schema.table": [{ col: value, ... }, ...] } for each table found.
 *
 * @param {string} text
 * @param {string[]} wanted
 * @returns {Record<string, Record<string, string | null>[]>}
 */
export function parseCopyBlocks(text, wanted) {
  const want = new Set(wanted);
  /** @type {Record<string, Record<string, string | null>[]>} */
  const tables = {};
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i += 1) {
    const header = lines[i].match(/^COPY ("?[\w]+"?)\.("?[\w]+"?) \((.*)\) FROM stdin;$/);
    if (!header) continue;

    const name = `${unquote(header[1])}.${unquote(header[2])}`;
    const columns = header[3].split(",").map((c) => unquote(c.trim()));
    const rows = [];

    for (i += 1; i < lines.length && lines[i] !== "\\."; i += 1) {
      if (!want.has(name)) continue;
      const line = lines[i].replace(/\r$/, "");
      const fields = line.split("\t");
      /** @type {Record<string, string | null>} */
      const row = {};
      columns.forEach((column, index) => {
        row[column] = decodeCopyField(fields[index] ?? "\\N");
      });
      rows.push(row);
    }

    if (want.has(name)) tables[name] = (tables[name] ?? []).concat(rows);
  }

  return tables;
}

/**
 * Shapes the Supabase rows into the Neon tables.
 *
 * profiles + auth.users + auth.identities collapse into `users`: the profile keeps its
 * id (so every lobby, membership and bet still points at the right person), and gains
 * the Google subject and email that the new sign-in matches on.
 */
export function shapeImport(tables) {
  const profiles = tables["public.profiles"] ?? [];
  const authUsers = tables["auth.users"] ?? [];
  const identities = tables["auth.identities"] ?? [];

  const emailById = new Map(authUsers.map((u) => [u.id, u.email]));
  const subById = new Map();
  for (const identity of identities) {
    if (identity.provider !== "google") continue;
    let sub = identity.provider_id;
    if (!sub && identity.identity_data) {
      try {
        sub = JSON.parse(identity.identity_data).sub ?? null;
      } catch {
        sub = null;
      }
    }
    if (sub) subById.set(identity.user_id, sub);
  }

  const users = profiles.map((p) => ({
    id: p.id,
    google_sub: subById.get(p.id) ?? null,
    email: emailById.get(p.id)?.toLowerCase() ?? null,
    display_name: p.display_name,
    avatar_url: p.avatar_url,
    created_at: p.created_at,
  }));

  return {
    users,
    lobbies: tables["public.lobbies"] ?? [],
    members: tables["public.lobby_members"] ?? [],
    bets: tables["public.bets"] ?? [],
    unmatched: users.filter((u) => !u.google_sub && !u.email).map((u) => u.display_name),
  };
}

export const DUMP_TABLES = [
  "public.profiles",
  "public.lobbies",
  "public.lobby_members",
  "public.bets",
  "auth.users",
  "auth.identities",
];

/**
 * Writes the shaped rows. `exec(text, params)` runs one statement and resolves to its
 * rows; the caller wraps the whole thing in a transaction so a failure part-way leaves
 * nothing behind.
 *
 * Re-running is safe: every insert is `on conflict do nothing`. If someone already
 * signed in to the new app before the import, they have a fresh id — their imported
 * row is matched to it by Google subject (or email) and everything they owned is
 * re-pointed at the id they actually have now.
 */
export async function writeImport(exec, data) {
  const idMap = new Map();
  const counts = { users: 0, lobbies: 0, members: 0, bets: 0 };

  for (const u of data.users) {
    const existing = await exec(
      `select id from public.users
        where id = $1
           or ($2::text is not null and google_sub = $2)
           or ($3::text is not null and google_sub is null and lower(email) = $3)
        order by (id = $1) desc
        limit 1`,
      [u.id, u.google_sub, u.email],
    );

    if (existing.length > 0) {
      idMap.set(u.id, existing[0].id);
      continue;
    }

    await exec(
      `insert into public.users (id, google_sub, email, display_name, avatar_url, created_at)
       values ($1, $2, $3, $4, $5, coalesce($6::timestamptz, now()))`,
      [u.id, u.google_sub, u.email, u.display_name, u.avatar_url, u.created_at],
    );
    idMap.set(u.id, u.id);
    counts.users += 1;
  }

  const map = (id) => (id == null ? null : (idMap.get(id) ?? id));

  for (const l of data.lobbies) {
    const rows = await exec(
      `insert into public.lobbies (id, code, name, host_id, status, created_at)
       values ($1, $2, $3, $4, $5, $6::timestamptz)
       on conflict do nothing
       returning id`,
      [l.id, l.code, l.name, map(l.host_id), l.status, l.created_at],
    );
    counts.lobbies += rows.length;
  }

  for (const m of data.members) {
    const rows = await exec(
      `insert into public.lobby_members (lobby_id, user_id, role, joined_at)
       values ($1, $2, $3, $4::timestamptz)
       on conflict do nothing
       returning lobby_id`,
      [m.lobby_id, map(m.user_id), m.role, m.joined_at],
    );
    counts.members += rows.length;
  }

  for (const b of data.bets) {
    const rows = await exec(
      `insert into public.bets (
         id, lobby_id, proposition, stake, creator_id, creator_side, acceptor_id,
         status, outcome, winner_id, loser_id,
         created_at, accepted_at, resolved_at, completed_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
               $12::timestamptz, $13::timestamptz, $14::timestamptz, $15::timestamptz)
       on conflict do nothing
       returning id`,
      [
        b.id, b.lobby_id, b.proposition, b.stake, map(b.creator_id), b.creator_side,
        map(b.acceptor_id), b.status, b.outcome, map(b.winner_id), map(b.loser_id),
        b.created_at, b.accepted_at, b.resolved_at, b.completed_at,
      ],
    );
    counts.bets += rows.length;
  }

  return counts;
}
