import type { SupabaseClient } from "@supabase/supabase-js";
import { applySnooze, buildReminderTimes } from "./calculations";
import {
  createRemindersSchema,
  snoozeReminderSchema,
  reminderPreferencesSchema,
} from "./schemas";
import type { ReminderRecord, ReminderPreferenceRecord } from "./types";

const COLUMNS =
  "id, target_type, target_id, user_id, household_id, remind_at, status, snoozed_until, snooze_count, delivered_at, created_at, updated_at";
async function currentUser(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("ابتدا وارد حساب خود شوید.");
  return data.user.id;
}
/** User JWT and RLS enforce both ownership and target access. */
export function directReminders(client: SupabaseClient) {
  return {
    async list(): Promise<ReminderRecord[]> {
      const rows: ReminderRecord[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await client
          .from("reminders")
          .select(COLUMNS)
          .order("remind_at", { ascending: false })
          .order("id", { ascending: false })
          .range(offset, offset + 499);
        if (error) throw new Error("دریافت یادآورها ناموفق بود.");
        rows.push(...((data ?? []) as ReminderRecord[]));
        if (!data || data.length < 500) return rows;
        if (rows.length >= 10000)
          throw new Error("تعداد یادآورها بیش از حد مجاز است.");
      }
    },
    async preferences(): Promise<ReminderPreferenceRecord | null> {
      const user = await currentUser(client);
      const { data, error } = await client
        .from("notification_preferences")
        .select(
          "id,user_id,in_app_enabled,web_push_enabled,quiet_hours_enabled,quiet_hours_start,quiet_hours_end,created_at,updated_at",
        )
        .eq("user_id", user)
        .maybeSingle();
      if (error) throw new Error("دریافت تنظیمات یادآور ناموفق بود.");
      return data as ReminderPreferenceRecord | null;
    },
    async savePreferences(input: unknown): Promise<void> {
      const value = reminderPreferencesSchema.parse(input);
      const user = await currentUser(client);
      const { error } = await client.from("notification_preferences").upsert(
        {
          user_id: user,
          in_app_enabled: value.inAppEnabled,
          web_push_enabled: value.webPushEnabled,
          quiet_hours_enabled: value.quietHoursEnabled,
          quiet_hours_start: value.quietHoursStart ?? null,
          quiet_hours_end: value.quietHoursEnd ?? null,
        },
        { onConflict: "user_id" },
      );
      if (error) throw new Error("ذخیره تنظیمات یادآور ناموفق بود.");
    },
    async create(input: unknown): Promise<void> {
      const parsed = createRemindersSchema.parse(input);
      const user = await currentUser(client);
      const { data: target, error: targetError } = await client
        .from(parsed.targetType === "TASK" ? "tasks" : "events")
        .select("id,household_id")
        .eq("id", parsed.targetId)
        .maybeSingle();
      if (targetError || !target)
        throw new Error("دسترسی به هدف یادآور ممکن نیست.");
      const rows = buildReminderTimes({
        baseDateTime: parsed.baseDateTime,
        offsetsMinutes: parsed.offsets.map((item) => item.minutesBefore),
      }).map((remind_at) => ({
        target_type: parsed.targetType,
        target_id: parsed.targetId,
        user_id: user,
        household_id: target.household_id,
        remind_at,
        status: "PENDING",
      }));
      const { error } = await client.from("reminders").insert(rows);
      if (error) throw new Error("ثبت یادآور ناموفق بود.");
    },
    async snooze(id: string, minutes: number): Promise<void> {
      snoozeReminderSchema.parse({ reminderId: id, minutes });
      const user = await currentUser(client);
      const { data, error } = await client
        .from("reminders")
        .select(COLUMNS)
        .eq("id", id)
        .eq("user_id", user)
        .maybeSingle();
      if (error || !data || !["PENDING", "SNOOZED"].includes(data.status))
        throw new Error("یادآور فعال پیدا نشد.");
      const update = applySnooze({
        reminder: data as ReminderRecord,
        minutes,
        now: new Date(),
      });
      const result = await client
        .from("reminders")
        .update(update)
        .eq("id", id)
        .eq("user_id", user)
        .eq("updated_at", data.updated_at)
        .select("id")
        .maybeSingle();
      if (result.error || !result.data)
        throw new Error("تعویق یادآور ناموفق بود؛ دوباره تلاش کنید.");
    },
    async remove(id: string): Promise<void> {
      const user = await currentUser(client);
      const { data, error } = await client
        .from("reminders")
        .delete()
        .eq("id", id)
        .eq("user_id", user)
        .select("id")
        .maybeSingle();
      if (error || !data) throw new Error("حذف یادآور ناموفق بود.");
    },
  };
}
