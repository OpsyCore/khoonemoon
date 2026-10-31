import type { SupabaseClient } from "@supabase/supabase-js";
import { applyTaskCompletion } from "./security";
import type { TaskRecord } from "./types";

const COLUMNS =
  "id, title, description, creator_id, owner_id, household_id, visibility, status, priority, due_at, completed_at, archived_at, created_at, updated_at, task_assignees(assignee_id), task_recurrences(frequency, interval_days, weekdays)";

/** RLS-scoped reads and completion; task creation/assignment still need porting. */
export function directTasks(client: SupabaseClient) {
  return {
    async list(): Promise<TaskRecord[]> {
      const { data, error } = await client
        .from("tasks")
        .select(COLUMNS)
        .is("archived_at", null)
        .order("created_at", { ascending: false });
      if (error) throw new Error("دریافت تسک‌ها ناموفق بود.");
      return (data ?? []) as TaskRecord[];
    },
    async completion(
      task: TaskRecord,
      action: "complete" | "undo",
    ): Promise<void> {
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
