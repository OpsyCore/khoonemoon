import type { ReminderRecord } from "@/features/reminders/types";

/**
 * The moment a reminder should actually fire: a snoozed reminder uses the snooze
 * target, everything else uses the original schedule.
 */
export function effectiveReminderAt(reminder: ReminderRecord): Date {
  if (reminder.status === "SNOOZED" && reminder.snoozed_until) {
    return new Date(reminder.snoozed_until);
  }

  return new Date(reminder.remind_at);
}

export function selectDueReminders({
  reminders,
  now,
}: {
  reminders: ReminderRecord[];
  now: Date;
}): ReminderRecord[] {
  return reminders
    .filter(
      (reminder) =>
        reminder.status === "PENDING" || reminder.status === "SNOOZED",
    )
    .filter((reminder) => effectiveReminderAt(reminder).getTime() <= now.getTime())
    .sort(
      (a, b) =>
        effectiveReminderAt(a).getTime() - effectiveReminderAt(b).getTime(),
    );
}

/**
 * Quiet hours pause delivery instead of dropping it: the reminder stays pending
 * and is picked up by the next dispatch run outside the quiet window.
 */
export function shouldDeferForQuietHours({
  now,
  quietHoursEnabled,
  quietHoursStart,
  quietHoursEnd,
}: {
  now: Date;
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}): boolean {
  if (!quietHoursEnabled || !quietHoursStart || !quietHoursEnd) return false;

  const parse = (value: string) => {
    const [hours, minutes] = value.split(":").map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    return hours * 60 + minutes;
  };

  const start = parse(quietHoursStart);
  const end = parse(quietHoursEnd);
  if (start === null || end === null) return false;

  const current = now.getHours() * 60 + now.getMinutes();

  if (start <= end) return current >= start && current < end;
  return current >= start || current < end;
}

export type DispatchPlan = {
  toSend: ReminderRecord[];
  deferred: ReminderRecord[];
  sentAt: string;
};

export function buildDispatchPlan({
  reminders,
  now,
  quietHours,
}: {
  reminders: ReminderRecord[];
  now: Date;
  quietHours: {
    enabled: boolean;
    start: string | null;
    end: string | null;
  };
}): DispatchPlan {
  const due = selectDueReminders({ reminders, now });
  const sentAt = now.toISOString();

  const deferredByQuietHours = shouldDeferForQuietHours({
    now,
    quietHoursEnabled: quietHours.enabled,
    quietHoursStart: quietHours.start,
    quietHoursEnd: quietHours.end,
  });

  if (deferredByQuietHours) {
    return { toSend: [], deferred: due, sentAt };
  }

  return { toSend: due, deferred: [], sentAt };
}
