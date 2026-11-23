#!/usr/bin/env node
/**
 * Guard against shipping a secret to the browser.
 *
 * Run after `npm run build`:  npm run check:secrets
 *
 * Scans every client-served asset in .next/static for the database connection string
 * (and its password, host and username separately), the Google client secret and the
 * Auth.js signing secret. The `server-only` imports in src/lib/db/* already turn a leak
 * into a build error; this is the belt-and-braces check that also catches a value
 * pasted somewhere by hand.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const staticDir = path.resolve(process.cwd(), ".next/static");

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

let files;
try {
  files = walk(staticDir);
} catch {
  console.error("No .next/static directory — run `npm run build` first.");
  process.exit(1);
}

const secrets = [];

function add(name, value) {
  if (typeof value === "string" && value.length >= 8) secrets.push([name, value]);
}

add("AUTH_SECRET", process.env.AUTH_SECRET);
add("AUTH_GOOGLE_SECRET", process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET);

for (const name of ["DATABASE_URL", "DATABASE_URL_UNPOOLED"]) {
  const value = process.env[name];
  if (!value) continue;

  add(name, value);

  // Also look for the parts on their own, in case something logs a partial URL.
  try {
    const parsed = new URL(value);
    add(`${name} password`, parsed.password);
    add(`${name} host`, parsed.hostname);
    if (parsed.username.length >= 8) add(`${name} user`, parsed.username);
  } catch {
    // not a parseable URL; the whole-string check above still applies
  }
}

const found = [];

for (const file of files) {
  const contents = readFileSync(file, "utf8");

  for (const [name, value] of secrets) {
    if (contents.includes(value)) found.push([name, path.relative(process.cwd(), file)]);
  }

  // Anything shaped like a Postgres URL with credentials, whatever its value.
  const shaped = contents.match(/postgres(?:ql)?:\/\/[^\s"'`]{0,40}:[^\s"'`@]{3,}@/);
  if (shaped) found.push(["a postgres:// URL with a password", path.relative(process.cwd(), file)]);
}

if (found.length > 0) {
  console.error("\n✖ Secrets found in the client bundle:\n");
  for (const [name, file] of found) console.error(`  ${name}  →  ${file}`);
  console.error("");
  process.exit(1);
}

console.log(
  secrets.length === 0
    ? `✓ Scanned ${files.length} client assets. No secrets configured locally to compare against.`
    : `✓ Scanned ${files.length} client assets against ${secrets.length} secrets. Clean.`,
);
