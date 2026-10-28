import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { buildDispatchPlan } from "@/features/reminders/dispatch";
import { buildPushPayload } from "@/features/reminders/push";
import type {
  ReminderPreferenceRecord,
  ReminderRecord,
} from "@/features/reminders/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionContext, serverError } from "@/lib/api/session";
import {
  sendPushNotification,
  type StoredSubscription,
} from "@/lib/push/web-push";

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

  // Web Push delivery for users who enabled it on at least one device.
  const pushByUser = await deliverPushNotifications({
    client,
    reminders: toSend,
    preferencesByUser,
    now,
  });

  return NextResponse.json({
    dispatched: toSend.length,
    deferred: deferredCount,
    sentAt: now.toISOString(),
    push: pushByUser.summary,
    notifications: toSend.map((reminder) => ({
      reminderId: reminder.id,
      userId: reminder.user_id,
      targetType: reminder.target_type,
      targetId: reminder.target_id,
      inAppEnabled:
        preferencesByUser.get(reminder.user_id)?.in_app_enabled ?? true,
      webPushEnabled:
        preferencesByUser.get(reminder.user_id)?.web_push_enabled ?? false,
    })),
  });
}

type PushOutcome = {
  sent: number;
  expired: number;
  failed: number;
  skipped: number;
  summary: { sent: number; expired: number; failed: number; skipped: number };
};

async function deliverPushNotifications({
  client,
  reminders,
  preferencesByUser,
  now,
}: {
  client: SupabaseClient;
  reminders: ReminderRecord[];
  preferencesByUser: Map<string, ReminderPreferenceRecord>;
  now: Date;
}): Promise<PushOutcome> {
  const outcome = { sent: 0, expired: 0, failed: 0, skipped: 0 };

  const pushUsers = [
    ...new Set(
      reminders
        .filter(
          (reminder) =>
            preferencesByUser.get(reminder.user_id)?.web_push_enabled,
        )
        .map((reminder) => reminder.user_id),
    ),
  ];

  if (pushUsers.length === 0) {
    outcome.skipped = reminders.length;
    return { ...outcome, summary: { ...outcome } };
  }

  const { data: subscriptions } = await client
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", pushUsers)
    .is("revoked_at", null);

  const subscriptionsByUser = new Map<
    string,
    (StoredSubscription & { user_id: string })[]
  >();

  (
    (subscriptions ?? []) as (StoredSubscription & { user_id: string })[]
  ).forEach((subscription) => {
    const list = subscriptionsByUser.get(subscription.user_id) ?? [];
    list.push(subscription);
    subscriptionsByUser.set(subscription.user_id, list);
  });

  const expiredIds: string[] = [];

  for (const reminder of reminders) {
    const preference = preferencesByUser.get(reminder.user_id);
    if (!preference?.web_push_enabled) {
      outcome.skipped += 1;
      continue;
    }

    const devices = subscriptionsByUser.get(reminder.user_id) ?? [];

    if (devices.length === 0) {
      outcome.skipped += 1;
      continue;
    }

    const payload = buildPushPayload({
      targetType: reminder.target_type,
      remindAt:
        reminder.status === "SNOOZED" && reminder.snoozed_until
          ? reminder.snoozed_until
          : reminder.remind_at,
      now,
    });

    for (const device of devices) {
      const result = await sendPushNotification({
        subscription: device,
        payload,
      });

      if (result.status === "sent") outcome.sent += 1;
      if (result.status === "expired") {
        outcome.expired += 1;
        expiredIds.push(device.id);
      }
      if (result.status === "failed") outcome.failed += 1;
      if (result.status === "not_configured") outcome.skipped += 1;
    }
  }

  if (expiredIds.length > 0) {
    await client
      .from("push_subscriptions")
      .update({ revoked_at: now.toISOString() })
      .in("id", expiredIds);
  }

  return { ...outcome, summary: { ...outcome } };
}
