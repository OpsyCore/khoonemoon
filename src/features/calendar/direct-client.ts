import { pendingCreate } from "@/lib/mutations/pending-create";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createEventSchema } from "./schemas";
import type { EventRecord } from "./types";

const COLUMNS =
  "id, title, description, creator_id, owner_id, household_id, visibility, start_at, end_at, all_day, location, occasion_type, recurrence_calendar, jalali_month, jalali_day, gift_idea, occasion_plan, created_at, updated_at";

/** Direct user-scoped transport; RLS on events enforces access. */
export function directCalendar(client: SupabaseClient) {
  return {
    async list(): Promise<EventRecord[]> {
      const rows: EventRecord[] = [];
      for (let offset = 0; offset <= 10000; offset += 500) {
        const { data, error } = await client
          .from("events")
          .select(COLUMNS)
          .order("start_at", { ascending: true })
          .order("id", { ascending: true })
          .range(offset, offset + 499);
        if (error) throw new Error("دریافت رویدادها ناموفق بود.");
        if (offset === 10000 && data?.length)
          throw new Error("تعداد رویدادها بیش از حد مجاز است.");
        rows.push(...((data ?? []) as EventRecord[]));
        if (!data || data.length < 500) return rows;
      }
      return rows;
    },
    async create(
      input: unknown,
      onConfirmed?: (event: EventRecord) => void,
    ): Promise<EventRecord> {
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
      const yearly = event.recurrenceCalendar === "JALALI_YEARLY";
      return pendingCreate<EventRecord>({
        user: auth.user.id,
        kind: "calendar",
        input: { event, householdId },
        onConfirmed,
        submit: (id) =>
          client
            .from("events")
            .insert({
              id,
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
              ...(event.occasionType !== undefined ||
              yearly ||
              event.giftIdea ||
              event.occasionPlan
                ? {
                    occasion_type: event.occasionType ?? null,
                    recurrence_calendar: yearly ? "JALALI_YEARLY" : null,
                    jalali_month: yearly ? (event.jalaliMonth ?? null) : null,
                    jalali_day: yearly ? (event.jalaliDay ?? null) : null,
                    gift_idea: event.giftIdea || null,
                    occasion_plan: event.occasionPlan || null,
                  }
                : {}),
            })
            .select(COLUMNS)
            .single(),
        find: (id) =>
          client.from("events").select(COLUMNS).eq("id", id).maybeSingle(),
      });
    },
    async update(id: string, input: unknown): Promise<EventRecord> {
      const event = createEventSchema.parse(input);
      const { data: auth, error: authError } = await client.auth.getUser();
      if (authError || !auth.user) throw new Error("ابتدا وارد حساب خود شوید.");
      let householdId: string | null = null;
      if (event.visibility === "HOUSEHOLD_SHARED") {
        const { data, error } = await client
          .from("household_members")
          .select("household_id")
          .eq("user_id", auth.user.id)
          .is("left_at", null)
          .maybeSingle();
        if (error || !data?.household_id)
          throw new Error("برای رویداد اشتراکی باید عضو خانه باشید.");
        householdId = data.household_id;
      }
      const yearly = event.recurrenceCalendar === "JALALI_YEARLY";
      const { data, error } = await client
        .from("events")
        .update({
          title: event.title,
          description: event.description || null,
          household_id: householdId,
          visibility: event.visibility,
          start_at: event.startAt,
          end_at: event.endAt,
          all_day: event.allDay,
          location: event.location || null,
          ...(event.occasionType !== undefined ||
          event.recurrenceCalendar !== undefined ||
          event.giftIdea !== undefined ||
          event.occasionPlan !== undefined
            ? {
                occasion_type: event.occasionType ?? null,
                recurrence_calendar: yearly ? "JALALI_YEARLY" : null,
                jalali_month: yearly ? (event.jalaliMonth ?? null) : null,
                jalali_day: yearly ? (event.jalaliDay ?? null) : null,
                gift_idea: event.giftIdea || null,
                occasion_plan: event.occasionPlan || null,
              }
            : {}),
        })
        .eq("id", id)
        .select(COLUMNS)
        .maybeSingle();
      if (error || !data) throw new Error("ویرایش رویداد ناموفق بود.");
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
