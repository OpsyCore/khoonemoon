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
  "profiles",
  "households",
  "household_members",
  "household_invitations",
  "shopping_lists",
  "shopping_items",
  "tasks",
  "task_assignees",
  "task_recurrences",
  "events",
  "chores",
  "chore_rotation_steps",
  "chore_completions",
  "financial_records",
  "reminders",
  "notification_preferences",
  "documents",
  "document_attachments",
];

/** Parents before children. This local drill excludes credentials, Storage bytes and production auth. */
const RESTORE_ORDER = [...AUTH_TABLES, ...TABLES];

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
  insert into public.household_members(household_id,user_id,role) values ('${HOUSEHOLD}','${USER_A}','OWNER');
  insert into public.household_invitations(household_id,invited_by,invite_code_hash,expires_at) values ('${HOUSEHOLD}','${USER_A}','local-test-hash',now()+interval '1 day');
  insert into public.tasks (household_id, owner_id, creator_id, title, visibility,due_at)
    values ('${HOUSEHOLD}', '${USER_A}', '${USER_A}', 'خرید نان', 'HOUSEHOLD_SHARED','2030-01-01T09:00:00Z');
  insert into public.task_assignees(task_id,assignee_id) select id,'${USER_A}' from public.tasks limit 1;
  insert into public.task_recurrences(task_id,frequency,recurrence_timezone) select id,'DAILY','Asia/Tehran' from public.tasks limit 1;
  insert into public.shopping_lists (household_id, name, created_by)
    values ('${HOUSEHOLD}', 'لیست هفتگی', '${USER_A}');
  insert into public.shopping_items (list_id, name, added_by) select id, 'شیر', '${USER_A}' from public.shopping_lists limit 1;
  insert into public.events (owner_id,creator_id,title,visibility,start_at,end_at) values ('${USER_A}','${USER_A}','گردهمایی','PRIVATE','2026-11-01T10:00:00Z','2026-11-01T11:00:00Z');
  insert into public.chores (household_id,created_by,title,frequency) values ('${HOUSEHOLD}','${USER_A}','ظرف‌ها','WEEKLY');
  insert into public.chore_rotation_steps(chore_id,position,assignee_id) select id,0,'${USER_A}' from public.chores limit 1;
  insert into public.chore_completions(chore_id,completed_by,note) select id,'${USER_A}','نمونه' from public.chores limit 1;
  insert into public.notification_preferences(user_id,quiet_hours_enabled,quiet_hours_start,quiet_hours_end) values ('${USER_A}',true,'22:00','08:00');
  insert into public.documents(id,created_by,title,mime_type,file_size,storage_path,visibility,category) values ('33333333-3333-4333-8333-333333333333','${USER_A}','سند نمونه','application/pdf',12,'user/${USER_A}/33333333-3333-4333-8333-333333333333/file.pdf','PRIVATE','OTHER');
  insert into public.document_attachments(document_id,entity_type,entity_id,created_by) select '33333333-3333-4333-8333-333333333333','TASK',id,'${USER_A}' from public.tasks limit 1;
  insert into public.reminders (user_id,household_id,target_type,target_id,remind_at) select '${USER_A}','${HOUSEHOLD}','TASK',id,'2026-11-01T09:00:00Z' from public.tasks limit 1;
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
    // auth.users insertion creates an automatic profile in this isolated shim.
    if (table === "profiles")
      await target.query("delete from public.profiles where id=$1", [row.id]);
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
  const original = [...snapshot[table]].sort((a, b) =>
    String(a.id).localeCompare(String(b.id)),
  );

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
        left === null || right === null
          ? left === right
          : typeof left === "object" || typeof right === "object"
            ? JSON.stringify(left) === JSON.stringify(right)
            : String(left) === String(right) ||
              (String(left).trim() !== "" &&
                String(right).trim() !== "" &&
                Number.isFinite(Number(left)) &&
                Number(left) === Number(right));

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

assert(
  ALL_TABLES.every((table) => sourceCounts[table] > 0),
  "هر جدول تمرین باید داده نمونه داشته باشد.",
);

console.log(
  `\n✔ تمرین بازگردانی موفق بود: ${restoredTotal} ردیف در ${ALL_TABLES.length} جدول، ${checked} مقدار مقایسه شد و همه یکسان بودند.`,
);
