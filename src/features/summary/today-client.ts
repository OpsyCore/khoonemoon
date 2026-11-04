import type { SupabaseClient } from "@supabase/supabase-js";
import {
  deriveToday,
  type TodayTask,
  type TodayEvent,
  type TodayChore,
  type TodayBill,
  type TodayReminder,
} from "./today-mobile";
const queries = {
  tasks: "id,title,due_at,status,priority",
  events: "id,title,start_at,end_at",
  chores: "id,title,next_due_at,is_active",
  financial_records: "id,title,due_at,paid_at,record_type",
  reminders:
    "id,remind_at,status,snoozed_until,delivered_at,target_type,target_id",
} as const;
async function list(client: SupabaseClient, table: keyof typeof queries) {
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; offset <= 10000; offset += 500) {
    let query = client.from(table).select(queries[table]);
    if (
      table === "tasks" ||
      table === "chores" ||
      table === "financial_records"
    )
      query = query.is("archived_at", null);
    const { data, error } = await query.order("id").range(offset, offset + 499);
    if (error) throw new Error("دریافت نمای امروز ناموفق بود.");
    if (offset === 10000 && data?.length)
      throw new Error("داده‌های نمای امروز بیش از حد مجاز است.");
    rows.push(...((data ?? []) as unknown as Record<string, unknown>[]));
    if (!data || data.length < 500) return rows;
  }
  throw new Error("داده‌های نمای امروز بیش از حد مجاز است.");
}
export async function getToday(client: SupabaseClient, now: Date) {
  const [tasks, events, chores, bills, reminders] = await Promise.all(
    (Object.keys(queries) as (keyof typeof queries)[]).map((table) =>
      list(client, table),
    ),
  );
  const targets = new Map<string, string>();
  for (const [type, rows] of [
    ["TASK", tasks],
    ["EVENT", events],
    ["CHORE", chores],
    ["BILL", bills],
  ] as const) {
    for (const row of rows)
      if (typeof row.id === "string" && typeof row.title === "string")
        targets.set(`${type}:${row.id}`, row.title);
  }
  const namedReminders = reminders.map((r) => ({
    ...r,
    title: targets.get(`${r.target_type}:${r.target_id}`) ?? "یادآور",
  }));
  return deriveToday({
    tasks: tasks as unknown as TodayTask[],
    events: events as unknown as TodayEvent[],
    chores: chores as unknown as TodayChore[],
    bills: bills as unknown as TodayBill[],
    reminders: namedReminders as unknown as TodayReminder[],
    now,
  });
}
