import { pendingChildId, pendingRequest } from "@/lib/mutations/pending-create";
import type { SupabaseClient } from "@supabase/supabase-js";
import { applySnooze, buildReminderTimes } from "./calculations";
import {
  createRemindersSchema,
  snoozeReminderSchema,
  reminderPreferencesSchema,
} from "./schemas";
import type {
  ReminderRecord,
  ReminderPreferenceRecord,
  ReminderTargetType,
} from "./types";
import { z } from "zod";

const V2_TARGET_TYPES = new Set<ReminderTargetType>([
  "DOCUMENT",
  "APPLIANCE",
  "MEAL",
]);

const mobileCreateSchema = createRemindersSchema.extend({
  targetType: z.enum([
    "TASK",
    "EVENT",
    "CHORE",
    "BILL",
    "DOCUMENT",
    "APPLIANCE",
    "MEAL",
  ]),
});

const targetTables: Record<ReminderTargetType, string> = {
  TASK: "tasks",
  EVENT: "events",
  CHORE: "chores",
  BILL: "financial_records",
  DOCUMENT: "documents",
  APPLIANCE: "home_appliances",
  MEAL: "meal_plans",
};

const COLUMNS =
  "id, target_type, target_id, user_id, household_id, remind_at, status, snoozed_until, snooze_count, delivered_at, created_at, updated_at";

async function currentUser(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("ابتدا وارد حساب خود شوید.");
  return data.user.id;
}

async function createInitialReminder(
  client: SupabaseClient,
  type: "TASK" | "EVENT",
  input: { targetId: string; baseDateTime: string; minutesBefore: number },
) {
  const parsed = mobileCreateSchema.parse({
    targetType: type,
    targetId: input.targetId,
    baseDateTime: input.baseDateTime,
    offsets: [{ minutesBefore: input.minutesBefore }],
  });
  const user = await currentUser(client);
  const { data: target, error: targetError } = await client
    .from(targetTables[type])
    .select("id,household_id")
    .eq("id", parsed.targetId)
    .maybeSingle();
  if (targetError || !target)
    throw new Error("دسترسی به هدف یادآور ممکن نیست.");
  const id = await pendingChildId(
    parsed.targetId,
    type === "TASK" ? 314159 : 314160,
  );
  const remindAt = buildReminderTimes({
    baseDateTime: parsed.baseDateTime,
    offsetsMinutes: [input.minutesBefore],
  })[0];
  try {
    const result = await client.from("reminders").insert({
      id,
      target_type: type,
      target_id: parsed.targetId,
      user_id: user,
      household_id: target.household_id,
      remind_at: remindAt,
      status: "PENDING",
    });
    if (!result.error) return;
  } catch {
    /* The insert may have committed. The same deterministic id is reused. */
  }
  const existing = await client
    .from("reminders")
    .select("id,target_type,target_id,user_id,remind_at")
    .eq("id", id)
    .eq("user_id", user)
    .maybeSingle();
  if (
    !existing.error &&
    existing.data?.target_type === type &&
    existing.data.target_id === parsed.targetId &&
    existing.data.user_id === user &&
    new Date(existing.data.remind_at).getTime() === new Date(remindAt).getTime()
  )
    return;
  throw new Error(
    "ثبت یادآوری تأیید نشد؛ فقط یادآوری را با همین اطلاعات دوباره امتحان کنید.",
  );
}

/** User JWT and RLS enforce both ownership and target access. */
export function directReminders(client: SupabaseClient) {
  return {
    async list(): Promise<ReminderRecord[]> {
      if (typeof client.rpc === "function") {
        const v2 = await client.rpc("mobile_list_reminders_v2");
        if (!v2.error && Array.isArray(v2.data)) {
          if (v2.data.length > 10000)
            throw new Error("تعداد یادآورها بیش از حد مجاز است.");
          return v2.data as ReminderRecord[];
        }
      }
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
    /** Fail closed rather than schedule a partial or unauthorized snapshot. */
    async authorizedSchedule(): Promise<ReminderRecord[]> {
      const { data, error } = await client.rpc(
        "mobile_authorized_reminder_schedule",
      );
      if (error || !Array.isArray(data) || data.length > 10000)
        throw new Error("دریافت برنامه امن یادآورها ناموفق بود.");
      return data as ReminderRecord[];
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
    async updateInApp(enabled: boolean): Promise<void> {
      const value = z.boolean().parse(enabled);
      const user = await currentUser(client);
      const { error } = await client
        .from("notification_preferences")
        .upsert(
          { user_id: user, in_app_enabled: value },
          { onConflict: "user_id" },
        );
      if (error) throw new Error("ذخیره تنظیمات یادآور ناموفق بود.");
    },
    async updateQuietHours(
      enabled: boolean,
      start: string | null,
      end: string | null,
    ): Promise<void> {
      const value = reminderPreferencesSchema.parse({
        inAppEnabled: true,
        webPushEnabled: false,
        quietHoursEnabled: enabled,
        quietHoursStart: enabled ? start : null,
        quietHoursEnd: enabled ? end : null,
      });
      if (
        value.quietHoursEnabled &&
        value.quietHoursStart === value.quietHoursEnd
      )
        throw new Error("شروع و پایان ساعات سکوت باید متفاوت باشند.");
      const user = await currentUser(client);
      const { error } = await client.from("notification_preferences").upsert(
        {
          user_id: user,
          quiet_hours_enabled: value.quietHoursEnabled,
          quiet_hours_start: value.quietHoursStart,
          quiet_hours_end: value.quietHoursEnd,
        },
        { onConflict: "user_id" },
      );
      if (error) throw new Error("ذخیره ساعات سکوت ناموفق بود.");
    },
    async create(input: unknown): Promise<void> {
      const parsed = mobileCreateSchema.parse(input);
      const user = await currentUser(client);
      const { data: target, error: targetError } = await client
        .from(targetTables[parsed.targetType])
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
      const isV2 = V2_TARGET_TYPES.has(parsed.targetType);
      await pendingRequest<true>({
        user,
        kind: "reminders",
        input: { parsed, householdId: target.household_id },
        submit: async (requestId) => {
          const ids = await Promise.all(
            rows.map((_, index) => pendingChildId(requestId, index)),
          );
          const withIds = rows.map((row, index) => ({
            ...row,
            id: ids[index],
          }));
          if (isV2) {
            const rpc = await client.rpc("mobile_create_reminders_v2", {
              p_rows: withIds,
            });
            return !rpc.error && Array.isArray(rpc.data)
              ? { data: true, error: null }
              : { data: null, error: rpc.error ?? "unknown" };
          }
          try {
            const result = await client.from("reminders").insert(withIds);
            if (!result.error) return { data: true, error: null };
          } catch {
            /* The whole insert may still commit. */
          }
          const existing = await client
            .from("reminders")
            .select("id")
            .in("id", ids)
            .eq("user_id", user);
          const found = new Set(
            (existing.data ?? []).map((row: { id: string }) => row.id),
          );
          return !existing.error && ids.every((id) => found.has(id))
            ? { data: true, error: null }
            : { data: null, error: existing.error ?? "unknown" };
        },
        valid: (value): value is true => value === true,
      });
    },
    async createTaskReminderOnce(input: {
      targetId: string;
      baseDateTime: string;
      minutesBefore: number;
    }): Promise<void> {
      return createInitialReminder(client, "TASK", input);
    },
    async createEventReminderOnce(input: {
      targetId: string;
      baseDateTime: string;
      minutesBefore: number;
    }): Promise<void> {
      return createInitialReminder(client, "EVENT", input);
    },
    async snooze(
      id: string,
      minutes: number,
      targetType?: ReminderTargetType,
    ): Promise<void> {
      snoozeReminderSchema.parse({ reminderId: id, minutes });
      await currentUser(client);
      if (targetType && V2_TARGET_TYPES.has(targetType)) {
        const until = new Date(Date.now() + minutes * 60_000).toISOString();
        const { data, error } = await client.rpc("mobile_mutate_reminder_v2", {
          p_id: id,
          p_action: "SNOOZE",
          p_until: until,
        });
        if (error || !data)
          throw new Error("تعویق یادآور ناموفق بود؛ دوباره تلاش کنید.");
        return;
      }
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
    async reschedule(id: string, remindAt: string): Promise<void> {
      const iso = z.string().datetime().parse(remindAt);
      await currentUser(client);
      if (new Date(iso).getTime() <= Date.now()) {
        throw new Error("زمان جدید یادآور باید در آینده باشد.");
      }
      const { data, error } = await client.rpc("mobile_mutate_reminder_v2", {
        p_id: id,
        p_action: "RESCHEDULE",
        p_until: iso,
      });
      if (error || !data)
        throw new Error("تغییر زمان یادآور ناموفق بود؛ فهرست را تازه کنید.");
    },
    async cancel(
      id: string,
      expectedUpdatedAt: string,
      targetType?: ReminderTargetType,
    ): Promise<void> {
      const user = await currentUser(client);
      if (targetType && V2_TARGET_TYPES.has(targetType)) {
        const { data, error } = await client.rpc("mobile_mutate_reminder_v2", {
          p_id: id,
          p_action: "CANCEL",
        });
        if (error || !data)
          throw new Error("وضعیت یادآور تغییر کرده است؛ فهرست را تازه کنید.");
        return;
      }
      const { data, error } = await client
        .from("reminders")
        .update({ status: "CANCELED" })
        .eq("id", id)
        .eq("user_id", user)
        .eq("updated_at", expectedUpdatedAt)
        .in("status", ["PENDING", "SNOOZED"])
        .is("delivered_at", null)
        .select("id")
        .maybeSingle();
      if (error || !data)
        throw new Error("وضعیت یادآور تغییر کرده است؛ فهرست را تازه کنید.");
    },
    async remove(id: string, targetType?: ReminderTargetType): Promise<void> {
      const user = await currentUser(client);
      if (targetType && V2_TARGET_TYPES.has(targetType)) {
        const { data, error } = await client.rpc("mobile_mutate_reminder_v2", {
          p_id: id,
          p_action: "REMOVE",
        });
        if (error || !data) throw new Error("حذف یادآور ناموفق بود.");
        return;
      }
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
