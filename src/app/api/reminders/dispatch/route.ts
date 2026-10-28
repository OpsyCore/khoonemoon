import { NextResponse } from "next/server";
import { buildDispatchPlan } from "@/features/reminders/dispatch";
import type {
  ReminderPreferenceRecord,
  ReminderRecord,
} from "@/features/reminders/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionContext, serverError } from "@/lib/api/session";

const REMINDER_SELECT =
  "id, target_type, target_id, user_id, household_id, remind_at, status, snoozed_until, snooze_count, delivered_at, created_at, updated_at";

function isCronRequest(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) return false;

  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

/**
 * Delivers due reminders.
 *
 * Two ways to call it:
 *  - cron / scheduler: `Authorization: Bearer $CRON_SECRET` → processes every
 *    user's reminders through the service role client.
 *  - signed-in user: processes only their own reminders (used by the app and by
 *    environments without a service role key).
 *
 * Quiet hours defer instead of dropping: the reminder stays pending and the
 * next run outside the window delivers it.
 */
export async function POST(request: Request) {
  const now = new Date();
  const cron = isCronRequest(request);
  const admin = cron ? createSupabaseAdminClient() : null;

  if (cron && !admin) {
    return NextResponse.json(
      {
        message:
          "برای اجرای زمان‌بندی‌شده، SUPABASE_SERVICE_ROLE_KEY باید تنظیم شده باشد.",
      },
      { status: 500 },
    );
  }

  let client = admin;
  let userId: string | null = null;

  if (!client) {
    const session = await getSessionContext();
    if (!session.ok) return session.response;

    client = session.context.supabase;
    userId = session.context.userId;
  }

  let remindersQuery = client
    .from("reminders")
    .select(REMINDER_SELECT)
    .in("status", ["PENDING", "SNOOZED"])
    .order("remind_at", { ascending: true })
    .limit(500);

  if (userId) {
    remindersQuery = remindersQuery.eq("user_id", userId);
  }

  const { data: reminders, error: remindersError } = await remindersQuery;

  if (remindersError) return serverError("دریافت یادآورها ناموفق بود.");

  const rows = (reminders ?? []) as ReminderRecord[];

  if (rows.length === 0) {
    return NextResponse.json({
      dispatched: 0,
      deferred: 0,
      notifications: [],
      sentAt: now.toISOString(),
    });
  }

  const affectedUserIds = [...new Set(rows.map((row) => row.user_id))];

  const { data: preferences } = await client
    .from("notification_preferences")
    .select(
      "id, user_id, in_app_enabled, web_push_enabled, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, created_at, updated_at",
    )
    .in("user_id", affectedUserIds);

  const preferencesByUser = new Map<string, ReminderPreferenceRecord>(
    ((preferences ?? []) as ReminderPreferenceRecord[]).map((preference) => [
      preference.user_id,
      preference,
    ]),
  );

  const grouped = new Map<string, ReminderRecord[]>();
  rows.forEach((row) => {
    const list = grouped.get(row.user_id) ?? [];
    list.push(row);
    grouped.set(row.user_id, list);
  });

  const toSend: ReminderRecord[] = [];
  let deferredCount = 0;

  grouped.forEach((userReminders, ownerId) => {
    const preference = preferencesByUser.get(ownerId);

    const plan = buildDispatchPlan({
      reminders: userReminders,
      now,
      quietHours: {
        enabled: preference?.quiet_hours_enabled ?? false,
        start: preference?.quiet_hours_start ?? null,
        end: preference?.quiet_hours_end ?? null,
      },
    });

    toSend.push(...plan.toSend);
    deferredCount += plan.deferred.length;
  });

  if (toSend.length === 0) {
    return NextResponse.json({
      dispatched: 0,
      deferred: deferredCount,
      notifications: [],
      sentAt: now.toISOString(),
    });
  }

  const { error: updateError } = await client
    .from("reminders")
    .update({ status: "SENT", delivered_at: now.toISOString() })
    .in(
      "id",
      toSend.map((reminder) => reminder.id),
    );

  if (updateError) return serverError("به‌روزرسانی وضعیت یادآورها ناموفق بود.");

  return NextResponse.json({
    dispatched: toSend.length,
    deferred: deferredCount,
    sentAt: now.toISOString(),
    notifications: toSend.map((reminder) => ({
      reminderId: reminder.id,
      userId: reminder.user_id,
      targetType: reminder.target_type,
      targetId: reminder.target_id,
      inAppEnabled: preferencesByUser.get(reminder.user_id)?.in_app_enabled ?? true,
      webPushEnabled:
        preferencesByUser.get(reminder.user_id)?.web_push_enabled ?? false,
    })),
  });
}
