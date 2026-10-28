/**
 * Runs the full migration + RLS assertion suite without a Postgres server.
 *
 * Uses PGlite (Postgres compiled to WASM) so contributors can validate schema
 * changes with `npm run db:check` even when no database is installed.
 *
 * Differences from a real Postgres run (see scripts/db-verify.sh for that):
 *  - `create extension pgcrypto` is skipped (gen_random_uuid() is built-in)
 *  - the pg_trgm GIN indexes are skipped (performance only, extension missing)
 *  - psql meta-commands (\set, \echo) are stripped
 *
 * Everything else — tables, RLS policies, RPCs, grants, constraints and the
 * assertions themselves — runs exactly as in CI.
 */
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = await PGlite.create();

function sanitize(sql) {
  return sql
    .replace(/create extension[^;]+;/gi, "")
    .replace(/create index[^;]*gin_trgm_ops[^;]*;/gi, "")
    .replace(/^\\.*$/gm, "");
}

const migrationFiles = readdirSync("drizzle")
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => `drizzle/${file}`);

const files = [
  "db/local/00_auth_shim.sql",
  ...migrationFiles,
  "db/local/10_assertions.sql",
];

for (const file of files) {
  try {
    await db.exec(sanitize(readFileSync(file, "utf8")));
    console.log(`ok    ${file}`);
  } catch (error) {
    console.error(`FAIL  ${file}\n${error.message}`);
    process.exit(1);
  }
}

console.log(
  "\nMigrations, grants and RLS assertions all passed (PGlite/WASM).",
);
