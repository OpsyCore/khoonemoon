import { pendingRequest } from "@/lib/mutations/pending-create";
import type { SupabaseClient } from "@supabase/supabase-js";
import { applyTaskCompletion } from "./security";
import { z } from "zod";
import { createTaskSchema } from "./schemas";
import type { TaskRecord } from "./types";

const COLUMNS =
  "id, title, description, creator_id, owner_id, household_id, visibility, status, priority, due_at, completed_at, archived_at, created_at, updated_at, task_assignees(assignee_id), task_recurrences(frequency, interval_days, weekdays, recurrence_timezone)";

/** User-scoped task operations. Completion atomically creates a successor when recurring. */
export function directTasks(client: SupabaseClient) {
  return {
    async create(input: unknown): Promise<string> {
      const task = createTaskSchema.parse(input);
      const { data: auth, error: authError } = await client.auth.getUser();
      if (authError || !auth.user) throw new Error("ابتدا وارد حساب خود شوید.");
      const payload = {
        ...task,
        recurrenceTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
      return pendingRequest<string>({
        user: auth.user.id,
        kind: "task",
        input: payload,
        submit: (id) =>
          client.rpc("mobile_create_once", {
            p_request_id: id,
            p_kind: "task",
            p_input: payload,
          }),
        valid: (value): value is string =>
          typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value),
      });
    },
    async update(
      id: string,
      input: unknown,
      recurrenceTimezone: string,
      expectedUpdatedAt: string,
    ): Promise<void> {
      const task = createTaskSchema.parse(input);
      const { data, error } = await client.rpc("mobile_update_task_guarded", {
        p_id: id,
        p_expected_updated_at: expectedUpdatedAt,
        p_input: {
          ...task,
          recurrenceTimezone:
            recurrenceTimezone ??
            Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      });
      if (error || data !== id)
        throw new Error(
          "ویرایش تأیید نشد یا تسک تغییر کرده است؛ پیش از تلاش دوباره فهرست را تازه کنید.",
        );
    },
    async list(): Promise<TaskRecord[]> {
      const rows: TaskRecord[] = [];
      for (let offset = 0; offset <= 10000; offset += 500) {
        const { data, error } = await client
          .from("tasks")
          .select(COLUMNS)
          .is("archived_at", null)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(offset, offset + 499);
        if (error) throw new Error("دریافت تسک‌ها ناموفق بود.");
        if (offset === 10000 && data?.length)
          throw new Error("تعداد تسک‌ها بیش از حد مجاز است.");
        rows.push(...((data ?? []) as TaskRecord[]));
        if (!data || data.length < 500) return rows;
      }
      return rows;
    },
    async rename(id: string, title: string): Promise<void> {
      const name = z.string().trim().min(2).max(180).parse(title);
      const { data, error } = await client
        .from("tasks")
        .update({ title: name })
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error || !data) throw new Error("ویرایش تسک ناموفق بود.");
    },
    async archive(id: string): Promise<void> {
      const { data, error } = await client
        .from("tasks")
        .update({ status: "ARCHIVED", archived_at: new Date().toISOString() })
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error || !data) throw new Error("بایگانی تسک ناموفق بود.");
    },
    async completion(
      task: TaskRecord,
      action: "complete" | "undo",
    ): Promise<void> {
      if (action === "complete") {
        const { error } = await client.rpc("mobile_complete_task", {
          p_task_id: task.id,
        });
        if (error) throw new Error("ثبت انجام تسک ناموفق بود.");
        return;
      }
      if (
        task.task_recurrences?.some(
          (recurrence) => recurrence.frequency !== "NONE",
        )
      ) {
        throw new Error("بازگرداندن تسک تکراری پشتیبانی نمی‌شود.");
      }
      const next = applyTaskCompletion({ currentStatus: task.status, action });
      const { data, error } = await client
        .from("tasks")
        .update({ status: next.status, completed_at: next.completedAt })
        .eq("id", task.id)
        .eq("status", task.status)
        .select("id")
        .maybeSingle();
      if (error || !data)
        throw new Error("وضعیت تسک تغییر کرد یا به‌روزرسانی ناموفق بود.");
    },
  };
}
