import { Temporal } from "@js-temporal/polyfill";
import type { TaskRecurrenceFrequency } from "@/features/tasks/types";

export type CalendarChore = {
  id: string;
  title: string;
  next_due_at: string;
  frequency: TaskRecurrenceFrequency;
  interval_days: number | null;
  weekdays: number[] | null;
  recurrence_timezone: string;
};

/** Project in the schedule's stored zone. The server remains authoritative. */
export function nextProjectedDue(
  current: Date,
  chore: CalendarChore,
): Date | null {
  if (chore.frequency === "NONE") return null;
  try {
    const zone = chore.recurrence_timezone;
    const local = Temporal.Instant.fromEpochMilliseconds(current.getTime())
      .toZonedDateTimeISO(zone)
      .toPlainDateTime();
    let next: Temporal.PlainDateTime;
    switch (chore.frequency) {
      case "DAILY":
        next = local.add({ days: 1 });
        break;
      case "INTERVAL_DAYS":
        next = local.add({ days: Math.max(chore.interval_days ?? 1, 1) });
        break;
      case "WEEKLY": {
        const days =
          chore.weekdays?.filter((day) => day >= 0 && day <= 6) ?? [];
        let offset = 7;
        if (days.length) {
          for (let i = 1; i <= 7; i++) {
            // Temporal uses ISO Monday=1..Sunday=7; SQL uses Sunday=0.
            if (days.includes(local.add({ days: i }).dayOfWeek % 7)) {
              offset = i;
              break;
            }
          }
        }
        next = local.add({ days: offset });
        break;
      }
      case "MONTHLY":
        next = local.add({ months: 1 });
        break;
      case "YEARLY":
        next = local.add({ years: 1 });
        break;
    }
    // PostgreSQL resolves folds to the later instant and advances across gaps.
    return new Date(
      next.toZonedDateTime(zone, { disambiguation: "later" }).epochMilliseconds,
    );
  } catch {
    // Never invent a projection for an invalid timezone or date.
    return null;
  }
}

export function projectChoreDates(chore: CalendarChore, from: Date, to: Date) {
  const initial = new Date(chore.next_due_at);
  if (
    !Number.isFinite(initial.getTime()) ||
    !Number.isFinite(from.getTime()) ||
    !Number.isFinite(to.getTime()) ||
    from >= to
  )
    return [];
  const result: { due: Date; current: boolean }[] = [];
  let due: Date | null = initial;
  // A bound prevents corrupt or ancient records from locking up the UI.
  for (let i = 0; due && due < to && i < 10000; i++) {
    if (due >= from) result.push({ due, current: i === 0 });
    const next = nextProjectedDue(due, chore);
    if (next && next <= due) break;
    due = next;
  }
  return result;
}
