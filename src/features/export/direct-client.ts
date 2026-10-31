import { zipSync, strToU8 } from "fflate";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildArchive,
  LEDGER_CSV_COLUMNS,
  toCsv,
  type ExportableRecord,
} from "./archive";

const TABLES = {
  tasks:
    "id,title,description,status,priority,due_at,completed_at,archived_at,created_at",
  events: "id,title,description,start_at,end_at,all_day,location,created_at",
  reminders: "id,target_type,target_id,remind_at,status,created_at",
  chores:
    "id,title,description,frequency,next_due_at,is_active,archived_at,created_at",
  chore_completions: "id,chore_id,completed_by,completed_at,due_at,note",
  shopping_lists: "id,name,created_at",
  shopping_items: "id,list_id,name,quantity,purchased,created_at",
  financial_records:
    "id,record_type,title,amount,currency,category,note,occurred_at,due_at,paid_at,archived_at",
  documents:
    "id,title,description,visibility,category,mime_type,file_size,storage_path,created_at",
} as const;

/** Explicit columns, JWT/RLS, stable pagination; never silently exports a partial table. */
async function readTable(
  client: SupabaseClient,
  table: keyof typeof TABLES,
): Promise<Record<string, unknown>[]> {
  const records: Record<string, unknown>[] = [];
  for (let offset = 0; offset < 10000; offset += 500) {
    const { data, error } = await client
      .from(table)
      .select(TABLES[table])
      .order("id", { ascending: true })
      .range(offset, offset + 499);
    if (error) throw new Error("استخراج اطلاعات ناموفق بود.");
    const page = (data ?? []) as unknown as Record<string, unknown>[];
    records.push(...page);
    if (page.length < 500) return records;
  }
  // Check for one more row rather than mislabeling an exact boundary as truncated.
  const { data, error } = await client
    .from(table)
    .select("id")
    .order("id", { ascending: true })
    .range(10000, 10000);
  if (error || (data?.length ?? 0) > 0)
    throw new Error("تعداد داده‌ها برای خروجی بیش از حد مجاز است.");
  return records;
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
  const names = Object.keys(TABLES) as (keyof typeof TABLES)[];
  const tables = await Promise.all(
    names.map(async (name) => ({ name, rows: await readTable(client, name) })),
  );
  return JSON.stringify(buildArchive({ tables, now }), null, 2);
}

/** Archive includes every listed file or fails; never emits a partial backup. */
export async function exportMobileBackup(
  client: SupabaseClient,
  now: Date,
): Promise<Uint8Array> {
  const names = Object.keys(TABLES) as (keyof typeof TABLES)[];
  const tables = await Promise.all(
    names.map(async (name) => ({ name, rows: await readTable(client, name) })),
  );
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
  const archive = buildArchive({ tables, now });
  archive.note =
    "این پرونده شامل داده‌های انتخاب‌شده و فایل‌های مدارک قابل مشاهده است؛ این خروجی عکس لحظه‌ای تراکنشی نیست و باید در جای امن نگهداری شود.";
  const json = strToU8(JSON.stringify(archive, null, 2));
  if (json.length > 4 * 1024 * 1024)
    throw new Error(
      "حجم اطلاعات خروجی بیش از ۴ مگابایت است؛ خروجی کامل ساخته نشد.",
    );
  files["archive.json"] = json;
  const zip = zipSync(files, { level: 0 });
  if (zip.length > 16 * 1024 * 1024)
    throw new Error("حجم خروجی بیش از ۱۶ مگابایت است.");
  return zip;
}
