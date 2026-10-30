import { NextResponse } from "next/server";

import {
  buildArchive,
  exportFileName,
  LEDGER_CSV_COLUMNS,
  toCsv,
  type ExportableRecord,
} from "@/features/export/archive";
import { getSessionContext, serverError } from "@/lib/api/session";

const TABLE_LIMIT = 5000;

/**
 * Downloads the caller's own data.
 *
 * Authorization is deliberately *not* re-implemented here: every query runs as
 * the signed-in user, so row-level security decides what comes back. A second
 * permission check in this file could drift from the policies and either leak or
 * silently under-export; RLS is the single source of truth.
 */
export async function GET(request: Request) {
  const session = await getSessionContext();
  if (!session.ok) return session.response;

  const { supabase } = session.context;
  const format =
    new URL(request.url).searchParams.get("format") === "csv" ? "csv" : "json";
  const now = new Date();

  const [tasks, events, reminders, chores, completions, lists, items, finance] =
    await Promise.all([
      supabase
        .from("tasks")
        .select(
          "id, title, description, status, priority, due_at, completed_at, archived_at, created_at",
        )
        .limit(TABLE_LIMIT),
      supabase
        .from("events")
        .select(
          "id, title, description, start_at, end_at, all_day, location, created_at",
        )
        .limit(TABLE_LIMIT),
      supabase
        .from("reminders")
        .select("id, target_type, target_id, remind_at, status, created_at")
        .limit(TABLE_LIMIT),
      supabase
        .from("chores")
        .select(
          "id, title, description, frequency, next_due_at, is_active, archived_at, created_at",
        )
        .limit(TABLE_LIMIT),
      supabase
        .from("chore_completions")
        .select("id, chore_id, completed_by, completed_at, due_at, note")
        .limit(TABLE_LIMIT),
      supabase
        .from("shopping_lists")
        .select("id, name, created_at")
        .limit(TABLE_LIMIT),
      supabase
        .from("shopping_items")
        .select("id, list_id, name, quantity, purchased, created_at")
        .limit(TABLE_LIMIT),
      supabase
        .from("financial_records")
        .select(
          "id, record_type, title, amount, currency, category, note, occurred_at, due_at, paid_at, archived_at",
        )
        .order("occurred_at", { ascending: false })
        .limit(TABLE_LIMIT),
    ]);

  const failed = [
    tasks,
    events,
    reminders,
    chores,
    completions,
    lists,
    items,
    finance,
  ].some((result) => result.error);

  if (failed)
    return serverError("استخراج اطلاعات ناموفق بود. دوباره تلاش کنید.");

  if (format === "csv") {
    const csv = toCsv({
      columns: LEDGER_CSV_COLUMNS,
      rows: (finance.data ?? []) as ExportableRecord[],
    });

    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${exportFileName({ extension: "csv", now })}"`,
        "cache-control": "no-store",
      },
    });
  }

  const archive = buildArchive({
    tables: [
      { name: "tasks", rows: tasks.data ?? [] },
      { name: "events", rows: events.data ?? [] },
      { name: "reminders", rows: reminders.data ?? [] },
      { name: "chores", rows: chores.data ?? [] },
      { name: "chore_completions", rows: completions.data ?? [] },
      { name: "shopping_lists", rows: lists.data ?? [] },
      { name: "shopping_items", rows: items.data ?? [] },
      { name: "financial_records", rows: finance.data ?? [] },
    ],
    now,
  });

  return NextResponse.json(archive, {
    headers: {
      "content-disposition": `attachment; filename="${exportFileName({ extension: "json", now })}"`,
      "cache-control": "no-store",
    },
  });
}
