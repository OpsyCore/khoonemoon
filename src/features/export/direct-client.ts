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
    "id,title,description,visibility,category,mime_type,file_size,created_at",
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
