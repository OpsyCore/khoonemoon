import type { SupabaseClient } from "@supabase/supabase-js";
import { applyTaskCompletion } from "./security";
import { z } from "zod";
import { createTaskSchema } from "./schemas";
import { getNextOccurrence } from "./recurrence";
import type { TaskRecord } from "./types";

const COLUMNS =
  "id, title, description, creator_id, owner_id, household_id, visibility, status, priority, due_at, completed_at, archived_at, created_at, updated_at, task_assignees(assignee_id), task_recurrences(frequency, interval_days, weekdays)";

/** User-scoped task operations. Completion atomically creates a successor when recurring. */
export function directTasks(client: SupabaseClient) {
  return {
    async create(input: unknown): Promise<string> {
      const task = createTaskSchema.parse(input);
      const next = getNextOccurrence({
        from: task.dueAt ? new Date(task.dueAt) : new Date(),
        recurrence: task.recurrence,
      });
      const { data, error } = await client.rpc("mobile_create_task", {
        p_input: { ...task, nextOccurrenceAt: next?.toISOString() ?? null },
      });
      if (error || typeof data !== "string")
        throw new Error("ساخت تسک ناموفق بود.");
      return data;
    },
    async update(id: string, input: unknown): Promise<void> {
      const task = createTaskSchema.parse(input);
      const next = getNextOccurrence({
        from: task.dueAt ? new Date(task.dueAt) : new Date(),
        recurrence: task.recurrence,
      });
      const { data, error } = await client.rpc("mobile_update_task", {
        p_id: id,
        p_input: { ...task, nextOccurrenceAt: next?.toISOString() ?? null },
      });
      if (error || data !== id) throw new Error("ویرایش تسک ناموفق بود.");
    },
    async list(): Promise<TaskRecord[]> {
      const { data, error } = await client
        .from("tasks")
        .select(COLUMNS)
        .is("archived_at", null)
        .order("created_at", { ascending: false });
      if (error) throw new Error("دریافت تسک‌ها ناموفق بود.");
      return (data ?? []) as TaskRecord[];
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
