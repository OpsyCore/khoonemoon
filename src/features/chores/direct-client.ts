import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChoreRecord, ChoreCompletion } from "./types";
import { createChoreSchema, updateChoreSchema } from "./schemas";
const COLUMNS =
  "id, household_id, title, description, created_by, rotation_mode, current_rotation_index, frequency, interval_days, weekdays, recurrence_timezone, next_due_at, is_active, completion_revision, archived_at, created_at, updated_at, chore_rotation_steps(id, chore_id, position, assignee_id)";

/** Uses the existing transactional completion RPC and database RLS. */
export function directChores(client: SupabaseClient) {
  return {
    async create(input: unknown): Promise<string> {
      const chore = createChoreSchema.parse(input);
      const { data, error } = await client.rpc("mobile_create_chore", {
        p_input: {
          ...chore,
          recurrenceTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      });
      if (error || typeof data !== "string")
        throw new Error("ساخت کار خانه ناموفق بود.");
      return data;
    },
    async update(
      id: string,
      input: unknown,
      recurrenceTimezone?: string,
    ): Promise<void> {
      const chore = createChoreSchema.parse(input);
      const { data, error } = await client.rpc("mobile_update_chore", {
        p_id: id,
        p_input: {
          ...chore,
          recurrenceTimezone:
            recurrenceTimezone ??
            Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      });
      if (error || data !== id) throw new Error("ویرایش کار خانه ناموفق بود.");
    },
    async list(householdId: string): Promise<ChoreRecord[]> {
      const rows: ChoreRecord[] = [];
      for (let offset = 0; offset <= 10000; offset += 500) {
        const { data, error } = await client
          .from("chores")
          .select(COLUMNS)
          .eq("household_id", householdId)
          .is("archived_at", null)
          .order("next_due_at", { ascending: true, nullsFirst: false })
          .order("id", { ascending: true })
          .range(offset, offset + 499);
        if (error) throw new Error("دریافت کارهای خانه ناموفق بود.");
        if (offset === 10000 && data?.length)
          throw new Error("تعداد کارهای خانه بیش از حد مجاز است.");
        rows.push(...((data ?? []) as ChoreRecord[]));
        if (!data || data.length < 500) return rows;
      }
      return rows;
    },
    async history(choreIds: string[]): Promise<ChoreCompletion[]> {
      if (!choreIds.length) return [];
      const { data, error } = await client
        .from("chore_completions")
        .select("id, chore_id, completed_by, completed_at, due_at, note")
        .in("chore_id", choreIds)
        .order("completed_at", { ascending: false })
        .limit(50);
      if (error) throw new Error("دریافت تاریخچه کارهای خانه ناموفق بود.");
      return (data ?? []) as ChoreCompletion[];
    },
    async rename(id: string, title: string): Promise<void> {
      const parsed = updateChoreSchema.parse({ title });
      const { data, error } = await client
        .from("chores")
        .update({ title: parsed.title })
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error || !data) throw new Error("ویرایش کار خانه ناموفق بود.");
    },
    async setActive(id: string, current: boolean): Promise<void> {
      const { data, error } = await client
        .from("chores")
        .update({ is_active: !current })
        .eq("id", id)
        .eq("is_active", current)
        .is("archived_at", null)
        .select("id")
        .maybeSingle();
      if (error || !data)
        throw new Error(
          "وضعیت کار تغییر کرده یا دسترسی وجود ندارد؛ فهرست را تازه کنید.",
        );
    },
    async archive(id: string): Promise<void> {
      const { data, error } = await client
        .from("chores")
        .update({ archived_at: new Date().toISOString(), is_active: false })
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error || !data) throw new Error("بایگانی کار خانه ناموفق بود.");
    },
    async completeVersion(id: string, revision: number): Promise<void> {
      const { data, error } = await client.rpc(
        "complete_chore_expected_version",
        { p_chore_id: id, p_expected_version: revision },
      );
      if (error || !data)
        throw new Error(
          "وضعیت کار تغییر کرد یا ثبت انجام تأیید نشد؛ فهرست را تازه کنید.",
        );
    },
    async complete(id: string): Promise<void> {
      const { error } = await client.rpc("complete_chore", { p_chore_id: id });
      if (error) throw new Error("ثبت انجام کار خانه ناموفق بود.");
    },
  };
}
