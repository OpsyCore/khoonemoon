import type { ReminderRecord } from "@/features/reminders/types";

export function buildReminderTimes({
  baseDateTime,
  offsetsMinutes,
}: {
  baseDateTime: string;
  offsetsMinutes: number[];
}) {
  const baseMs = new Date(baseDateTime).getTime();

  return [...offsetsMinutes]
    .sort((a, b) => b - a)
    .map((minutesBefore) =>
      new Date(baseMs - minutesBefore * 60_000).toISOString(),
    );
}

export function calculateUpcomingReminders({
  reminders,
  now,
  horizonHours,
}: {
  reminders: ReminderRecord[];
  now: Date;
  horizonHours: number;
}) {
  const nowMs = now.getTime();
  const horizonMs = nowMs + horizonHours * 60 * 60 * 1000;

  return reminders
    .filter(
      (reminder) =>
        reminder.status === "PENDING" || reminder.status === "SNOOZED",
    )
    .map((reminder) => {
      const effectiveAt =
        reminder.status === "SNOOZED" && reminder.snoozed_until
          ? reminder.snoozed_until
          : reminder.remind_at;

      return {
        ...reminder,
        effective_at: effectiveAt,
      };
    })
    .filter((reminder) => {
      const t = new Date(reminder.effective_at).getTime();
      return t >= nowMs && t <= horizonMs;
    })
    .sort(
      (a, b) =>
        new Date(a.effective_at).getTime() - new Date(b.effective_at).getTime(),
    );
}

export function applySnooze({
  reminder,
  minutes,
  now,
}: {
  reminder: Pick<ReminderRecord, "status" | "snooze_count">;
  minutes: number;
  now: Date;
}) {
  const snoozedUntil = new Date(now.getTime() + minutes * 60_000).toISOString();

  return {
    status: "SNOOZED" as const,
    snoozed_until: snoozedUntil,
    snooze_count: reminder.snooze_count + 1,
  };
}

export function isInQuietHours({
  now,
  quietHoursStart,
  quietHoursEnd,
}: {
  now: Date;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}) {
  if (!quietHoursStart || !quietHoursEnd) return false;

  const [startH, startM] = quietHoursStart.split(":").map(Number);
  const [endH, endM] = quietHoursEnd.split(":").map(Number);

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}
