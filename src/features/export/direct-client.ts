import { zipSync, strToU8 } from "fflate";
import { buildChecksums } from "./backup-integrity";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildArchive,
  LEDGER_CSV_COLUMNS,
  toCsv,
  type ExportableRecord,
} from "./archive";

const TABLES: Record<string, string> = {
  profiles: "id,full_name,timezone,locale,created_at,updated_at",
  households: "id,name,created_by,created_at,updated_at",
  household_members:
    "id,household_id,user_id,role,joined_at,left_at,created_at",
  task_recurrence_instances: "completed_task_id,next_task_id,created_at",
  finance_recurrence_instances: "paid_record_id,next_record_id,created_at",
  tasks:
    "id,title,description,creator_id,owner_id,household_id,visibility,status,priority,due_at,completed_at,archived_at,created_at,updated_at",
  task_assignees: "id,task_id,assignee_id,created_at",
  task_recurrences:
    "id,task_id,frequency,interval_days,weekdays,next_occurrence_at,recurrence_timezone,created_at,updated_at",
  events:
    "id,title,description,creator_id,owner_id,household_id,visibility,start_at,end_at,all_day,location,created_at,updated_at",
  reminders:
    "id,target_type,target_id,user_id,household_id,remind_at,status,snoozed_until,snooze_count,delivered_at,created_at,updated_at",
  notification_preferences:
    "id,user_id,in_app_enabled,web_push_enabled,quiet_hours_enabled,quiet_hours_start,quiet_hours_end,created_at,updated_at",
  chores:
    "id,household_id,title,description,created_by,rotation_mode,current_rotation_index,frequency,interval_days,weekdays,next_due_at,recurrence_timezone,is_active,completion_revision,archived_at,created_at,updated_at",
  chore_rotation_steps: "id,chore_id,position,assignee_id,created_at",
  chore_completions:
    "id,chore_id,completed_by,completed_at,due_at,note,created_at",
  shopping_lists:
    "id,household_id,name,created_by,archived_at,created_at,updated_at",
  shopping_items:
    "id,list_id,name,quantity,unit,category,note,added_by,purchased,purchased_by,purchased_at,position,created_at,updated_at",
  financial_records:
    "id,household_id,owner_id,created_by,visibility,record_type,title,amount,currency,category,note,occurred_at,due_at,bill_status,is_recurring,recurrence_rule,recurrence_timezone,paid_by,paid_at,archived_at,created_at,updated_at",
  documents:
    "id,household_id,created_by,title,description,visibility,category,mime_type,file_size,storage_path,created_at,updated_at",
  document_attachments:
    "id,document_id,entity_type,entity_id,created_by,created_at",
};

const SORT_KEYS: Record<string, string> = {
  task_recurrence_instances: "completed_task_id",
  finance_recurrence_instances: "paid_record_id",
};

/** Explicit columns, JWT/RLS, stable pagination; never silently exports a partial table. */
async function readTable(
  client: SupabaseClient,
  table: keyof typeof TABLES,
): Promise<Record<string, unknown>[]> {
  const records: Record<string, unknown>[] = [];
  const sortKey = SORT_KEYS[table] ?? "id";
  for (let offset = 0; offset < 10000; offset += 500) {
    const { data, error } = await client
      .from(table)
      .select(TABLES[table])
      .order(sortKey, { ascending: true })
      .range(offset, offset + 499);
    if (error) throw new Error("استخراج اطلاعات ناموفق بود.");
    const page = (data ?? []) as unknown as Record<string, unknown>[];
    records.push(...page);
    if (page.length < 500) return records;
  }
  // Check for one more row rather than mislabeling an exact boundary as truncated.
  const { data, error } = await client
    .from(table)
    .select(sortKey)
    .order(sortKey, { ascending: true })
    .range(10000, 10000);
  if (error || (data?.length ?? 0) > 0)
    throw new Error("تعداد داده‌ها برای خروجی بیش از حد مجاز است.");
  return records;
}
/** One database snapshot under caller RLS; attachment bytes are read separately. */
async function readSnapshot(client: SupabaseClient): Promise<{
  tables: { name: string; rows: Record<string, unknown>[] }[];
  snapshotAt: string;
}> {
  const { data, error } = await client.rpc("mobile_export_snapshot");
  if (
    error ||
    !data ||
    typeof data !== "object" ||
    !data.tables ||
    !data.counts ||
    typeof data.exported_at !== "string" ||
    !Number.isFinite(Date.parse(data.exported_at))
  )
    throw new Error(
      "ساخت خروجی اطلاعات ناموفق بود؛ اتصال یا محدودیت حجم را بررسی کنید.",
    );
  const names = Object.keys(TABLES);
  if (
    Object.keys(data.tables).length !== names.length ||
    Object.keys(data.counts).length !== names.length
  )
    throw new Error("ساختار خروجی اطلاعات نامعتبر است.");
  const tables = names.map((name) => {
    const rows = data.tables[name];
    if (
      !Array.isArray(rows) ||
      rows.length > 10000 ||
      data.counts[name] !== rows.length ||
      rows.some((row) => !row || typeof row !== "object" || Array.isArray(row))
    )
      throw new Error("اطلاعات خروجی ناقص است.");
    return { name, rows: rows as Record<string, unknown>[] };
  });
  return { tables, snapshotAt: data.exported_at };
}
export async function exportMobileData(
  client: SupabaseClient,
  format: "json" | "csv",
  now: Date,
): Promise<string> {
  if (format === "csv") {
    const rows = await readTable(client, "financial_records");
    return toCsv({
      columns: LEDGER_CSV_COLUMNS,
      rows: rows as unknown as ExportableRecord[],
    });
  }
  const { tables, snapshotAt } = await readSnapshot(client);
  return JSON.stringify(
    { ...buildArchive({ tables, now }), snapshot_at: snapshotAt },
    null,
    2,
  );
}

/** Archive includes every listed file or fails; never emits a partial backup. */
export async function exportMobileBackup(
  client: SupabaseClient,
  now: Date,
): Promise<Uint8Array> {
  const { tables, snapshotAt } = await readSnapshot(client);
  const documents = tables.find((table) => table.name === "documents")!;
  if (documents.rows.length > 200)
    throw new Error(
      "تعداد فایل‌های مدارک بیش از ۲۰۰ مورد است؛ خروجی کامل ساخته نشد.",
    );
  const extensions: Record<string, string> = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const files: Record<string, Uint8Array> = {};
  let total = 0;
  for (const row of documents.rows) {
    const id = String(row.id ?? ""),
      path = String(row.storage_path ?? ""),
      ext = extensions[String(row.mime_type ?? "")];
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      ) ||
      !path ||
      !ext
    )
      throw new Error("اطلاعات یکی از مدارک معتبر نیست؛ خروجی کامل ساخته نشد.");
    const size = Number(row.file_size);
    if (
      !Number.isSafeInteger(size) ||
      size <= 0 ||
      total + size > 12 * 1024 * 1024
    )
      throw new Error(
        "حجم فایل‌های مدارک بیش از ۱۲ مگابایت است؛ خروجی کامل ساخته نشد.",
      );
    const { data, error } = await client.storage
      .from("documents")
      .download(path);
    if (error || !data || data.size !== size)
      throw new Error("دریافت یکی از مدارک ناموفق بود؛ خروجی ناقص ذخیره نشد.");
    total += data.size;
    const name = `documents/${id}.${ext}`;
    if (files[name]) throw new Error("شناسه تکراری مدرک؛ خروجی ساخته نشد.");
    files[name] = new Uint8Array(await data.arrayBuffer());
    row.archive_file = name;
    delete row.storage_path;
  }
  const archive = { ...buildArchive({ tables, now }), snapshot_at: snapshotAt };
  archive.note =
    "این پرونده شامل داده‌های انتخاب‌شده از یک لحظهٔ پایگاه داده و فایل‌های مدارک قابل مشاهده است؛ فایل‌ها در زمان جداگانه دریافت شده‌اند. این خروجی نسخهٔ کامل حساب نیست و باید در جای امن نگهداری شود.";
  const json = strToU8(JSON.stringify(archive, null, 2));
  if (json.length > 4 * 1024 * 1024)
    throw new Error(
      "حجم اطلاعات خروجی بیش از ۴ مگابایت است؛ خروجی کامل ساخته نشد.",
    );
  files["archive.json"] = json;
  files["checksums.json"] = await buildChecksums(files);
  const zip = zipSync(files, { level: 0 });
  if (zip.length > 16 * 1024 * 1024)
    throw new Error("حجم خروجی بیش از ۱۶ مگابایت است.");
  return zip;
}
