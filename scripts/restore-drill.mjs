/**
 * Backup / restore drill.
 *
 * A backup nobody has restored is a hope, not a backup. This script performs the
 * whole cycle against real Postgres tables:
 *
 *   1. build a database from the migrations (PGlite/WASM, no server needed)
 *   2. insert a small, known dataset
 *   3. "back up" by copying every table's rows into a JSON snapshot
 *   4. build a second, empty database from the same migrations
 *   5. restore the snapshot into it
 *   6. compare the two databases row by row
 *
 * Step 6 is the point: it verifies the data survived the round-trip, not that the
 * export command exited 0.
 *
 * This drills the *application-level* backup (rows + foreign keys in the right
 * order). Production additionally relies on Supabase's own PITR /
 * `pg_dump` — see DEPLOYMENT.md for that runbook.
 *
 * Usage: npm run drill:restore
 */
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

function sanitize(sql) {
  return sql
    .replace(/create extension[^;]+;/gi, "")
    .replace(/create index[^;]*gin_trgm_ops[^;]*;/gi, "")
    .replace(/^\\..*$/gm, "");
}

const MIGRATIONS = [
  "db/local/00_auth_shim.sql",
  ...readdirSync("drizzle")
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => `drizzle/${file}`),
];

async function buildDatabase() {
  const db = await PGlite.create();

  for (const file of MIGRATIONS) {
    await db.exec(sanitize(readFileSync(file, "utf8")));
  }

  return db;
}

/**
 * Tables we drill on: they are writable without a signed-in Supabase user.
 *
 * `auth.users` is included on purpose. Restoring the domain tables without the
 * users they point at fails on the first foreign key — the drill found this the
 * hard way, and a real restore would fail exactly the same way.
 */
const AUTH_TABLES = ["auth.users"];

const TABLES = [
  "households",
  "shopping_lists",
  "shopping_items",
  "tasks",
  "events",
  "chores",
  "financial_records",
  "reminders",
];

/**
 * Order matters on restore: parents before children, or the foreign keys refuse
 * the insert. That ordering is exactly what a naive restore gets wrong.
 */
const RESTORE_ORDER = [
  "auth.users",
  "households",
  "shopping_lists",
  "shopping_items",
  "tasks",
  "events",
  "chores",
  "financial_records",
  "reminders",
];

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

const USER_A = "11111111-1111-4111-8111-111111111111";
const HOUSEHOLD = "22222222-2222-4222-8222-222222222222";

console.log("۱) ساخت پایگاه اولیه از مهاجرت‌ها…");
const source = await buildDatabase();

console.log("۲) درج داده‌ی نمونه…");
await source.exec(`
  insert into auth.users (id, email) values ('${USER_A}', 'a@example.com');
  insert into public.households (id, name, created_by) values ('${HOUSEHOLD}', 'خانهٔ آزمایشی', '${USER_A}');
  insert into public.tasks (household_id, owner_id, creator_id, title, visibility)
    values ('${HOUSEHOLD}', '${USER_A}', '${USER_A}', 'خرید نان', 'HOUSEHOLD_SHARED');
  insert into public.shopping_lists (household_id, name, created_by)
    values ('${HOUSEHOLD}', 'لیست هفتگی', '${USER_A}');
  insert into public.financial_records (household_id, owner_id, created_by, title, amount, visibility, record_type)
    values ('${HOUSEHOLD}', '${USER_A}', '${USER_A}', 'قبض برق', 450000, 'HOUSEHOLD_SHARED', 'BILL');
`);

console.log("۳) گرفتن نسخهٔ پشتیبان (JSON)…");
const snapshot = {};

/** `auth.users` lives in another schema; everything else is in `public`. */
function qualified(table) {
  return table.includes(".") ? table : `public.${table}`;
}

for (const table of [...AUTH_TABLES, ...TABLES]) {
  const result = await source.query(`select * from ${qualified(table)}`);
  snapshot[table] = result.rows;
}

const ALL_TABLES = [...AUTH_TABLES, ...TABLES];

const sourceCounts = Object.fromEntries(
  ALL_TABLES.map((table) => [table, snapshot[table].length]),
);

for (const [table, rows] of Object.entries(sourceCounts)) {
  console.log(`   ${table.padEnd(20)} ${rows} ردیف`);
}

console.log("۴) ساخت پایگاه دوم از همان مهاجرت‌ها…");
const target = await buildDatabase();

console.log("۵) بازگردانی نسخه…");
for (const table of RESTORE_ORDER) {
  const rows = snapshot[table];

  for (const row of rows) {
    const columns = Object.keys(row);
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
    const values = columns.map((column) => row[column]);

    await target.query(
      `insert into ${qualified(table)} (${columns
        .map((column) => `"${column}"`)
        .join(", ")}) values (${placeholders})`,
      values,
    );
  }
}

console.log("۶) مقایسهٔ ردیف‌به‌ردیف…");
let checked = 0;

for (const table of ALL_TABLES) {
  const restored = await target.query(
    `select * from ${qualified(table)} order by id`,
  );
  const original = [...snapshot[table]].sort((a, b) => String(a.id).localeCompare(String(b.id)));

  assert(
    restored.rows.length === original.length,
    `${table}: ${restored.rows.length} ردیف بازگردانده شد، انتظار ${original.length}`,
  );

  for (let index = 0; index < original.length; index += 1) {
    const expected = original[index];
    const actual = restored.rows[index];

    for (const column of Object.keys(expected)) {
      const left = expected[column];
      const right = actual[column];

      // `numeric`/`bigint` come back as strings or numbers depending on the driver.
      const same =
        String(left) === String(right) ||
        (Number.isFinite(Number(left)) && Number(left) === Number(right));

      assert(
        same,
        `${table}.${column} در ردیف ${index + 1}: «${left}» ≠ «${right}»`,
      );

      checked += 1;
    }
  }
}

const restoredTotal = ALL_TABLES.reduce(
  (sum, table) => sum + sourceCounts[table],
  0,
);

assert(restoredTotal > 0, "نسخهٔ پشتیبان خالی بود؛ تمرین بی‌معناست.");

console.log(
  `\n✔ تمرین بازگردانی موفق بود: ${restoredTotal} ردیف در ${ALL_TABLES.length} جدول، ${checked} مقدار مقایسه شد و همه یکسان بودند.`,
);
