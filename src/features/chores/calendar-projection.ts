import type { TaskRecurrenceFrequency } from "@/features/tasks/types";

export type CalendarChore = {
  id: string;
  title: string;
  next_due_at: string;
  frequency: TaskRecurrenceFrequency;
  interval_days: number | null;
  weekdays: number[] | null;
};

/** Mirrors calculate_next_chore_due on Supabase (UTC). Projected dates are
 * estimates: completing a chore advances the server's actual schedule. */
export function nextProjectedDue(
  current: Date,
  chore: CalendarChore,
): Date | null {
  const base = new Date(
    Date.UTC(
      current.getUTCFullYear(),
      current.getUTCMonth(),
      current.getUTCDate(),
    ),
  );
  switch (chore.frequency) {
    case "NONE":
      return null;
    case "DAILY":
      base.setUTCDate(base.getUTCDate() + 1);
      break;
    case "INTERVAL_DAYS":
      base.setUTCDate(
        base.getUTCDate() + Math.max(chore.interval_days ?? 1, 1),
      );
      break;
    case "WEEKLY": {
      const days = chore.weekdays?.filter((day) => day >= 0 && day <= 6) ?? [];
      let offset = 7;
      if (days.length) {
        for (let i = 1; i <= 14; i++) {
          if (days.includes((base.getUTCDay() + i) % 7)) {
            offset = i;
            break;
          }
        }
      }
      base.setUTCDate(base.getUTCDate() + offset);
      break;
    }
    case "MONTHLY":
    case "YEARLY": {
      const day = base.getUTCDate();
      const monthOffset = chore.frequency === "MONTHLY" ? 1 : 12;
      base.setUTCDate(1);
      base.setUTCMonth(base.getUTCMonth() + monthOffset);
      const lastDay = new Date(
        Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0),
      ).getUTCDate();
      base.setUTCDate(Math.min(day, lastDay));
      break;
    }
  }
  return base;
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
