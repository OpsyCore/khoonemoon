import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChoreRecord } from "./types";
import { createChoreSchema, updateChoreSchema } from "./schemas";
const COLUMNS =
  "id, household_id, title, description, created_by, rotation_mode, current_rotation_index, frequency, interval_days, weekdays, next_due_at, is_active, archived_at, created_at, updated_at, chore_rotation_steps(id, chore_id, position, assignee_id)";

/** Uses the existing transactional completion RPC and database RLS. */
export function directChores(client: SupabaseClient) {
  return {
    async create(input: unknown): Promise<string> {
      const chore = createChoreSchema.parse(input);
      const { data, error } = await client.rpc("mobile_create_chore", {
        p_input: chore,
      });
      if (error || typeof data !== "string")
        throw new Error("ساخت کار خانه ناموفق بود.");
      return data;
    },
    async list(householdId: string): Promise<ChoreRecord[]> {
      const { data, error } = await client
        .from("chores")
        .select(COLUMNS)
        .eq("household_id", householdId)
        .is("archived_at", null)
        .order("next_due_at", { ascending: true, nullsFirst: false });
      if (error) throw new Error("دریافت کارهای خانه ناموفق بود.");
      return (data ?? []) as ChoreRecord[];
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
    async archive(id: string): Promise<void> {
      const { data, error } = await client
        .from("chores")
        .update({ archived_at: new Date().toISOString(), is_active: false })
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error || !data) throw new Error("بایگانی کار خانه ناموفق بود.");
    },
    async complete(id: string): Promise<void> {
      const { error } = await client.rpc("complete_chore", { p_chore_id: id });
      if (error) throw new Error("ثبت انجام کار خانه ناموفق بود.");
    },
  };
}
