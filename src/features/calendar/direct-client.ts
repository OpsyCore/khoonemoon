import type { SupabaseClient } from "@supabase/supabase-js";
import { createEventSchema } from "./schemas";
import type { EventRecord } from "./types";

const COLUMNS =
  "id, title, description, creator_id, owner_id, household_id, visibility, start_at, end_at, all_day, location, created_at, updated_at";

/** Direct user-scoped transport; RLS on events enforces access. */
export function directCalendar(client: SupabaseClient) {
  return {
    async list(): Promise<EventRecord[]> {
      const { data, error } = await client
        .from("events")
        .select(COLUMNS)
        .order("start_at", { ascending: true });
      if (error) throw new Error("دریافت رویدادها ناموفق بود.");
      return (data ?? []) as EventRecord[];
    },
    async create(input: unknown): Promise<EventRecord> {
      const event = createEventSchema.parse(input);
      const { data: auth, error: authError } = await client.auth.getUser();
      if (authError || !auth.user) throw new Error("ابتدا وارد حساب خود شوید.");
      let householdId: string | null = null;
      if (event.visibility === "HOUSEHOLD_SHARED") {
        const { data: membership, error } = await client
          .from("household_members")
          .select("household_id")
          .eq("user_id", auth.user.id)
          .is("left_at", null)
          .maybeSingle();
        if (error || !membership?.household_id)
          throw new Error("برای رویداد اشتراکی باید عضو خانه باشید.");
        householdId = membership.household_id;
      }
      const { data, error } = await client
        .from("events")
        .insert({
          title: event.title,
          description: event.description || null,
          creator_id: auth.user.id,
          owner_id: auth.user.id,
          household_id: householdId,
          visibility: event.visibility,
          start_at: event.startAt,
          end_at: event.endAt,
          all_day: event.allDay,
          location: event.location || null,
        })
        .select(COLUMNS)
        .single();
      if (error || !data) throw new Error("ایجاد رویداد ناموفق بود.");
      return data as EventRecord;
    },
    async remove(id: string): Promise<void> {
      const { data, error } = await client
        .from("events")
        .delete()
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error || !data) throw new Error("حذف رویداد ناموفق بود.");
    },
  };
}
