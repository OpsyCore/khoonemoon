import { getJalaliWeekRange } from "@/shared/utils/jalali";
import type {
  CleaningChecklistItem,
  TaskRecord,
  TaskRecurrenceFrequency,
} from "./types";

export type CleaningCadencePreset =
  "NONE" | "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "SEASONAL";

export const CLEANING_CADENCE_LABELS: Record<CleaningCadencePreset, string> = {
  NONE: "یک‌بار",
  DAILY: "روزانه",
  WEEKLY: "هفتگی",
  BIWEEKLY: "دوهفته‌ای",
  MONTHLY: "ماهانه",
  SEASONAL: "فصلی",
};

export function cadenceToRecurrence(
  preset: CleaningCadencePreset,
  defaultWeekday = 6,
): {
  frequency: TaskRecurrenceFrequency;
  intervalDays?: number;
  weekdays?: number[];
} {
  switch (preset) {
    case "DAILY":
      return { frequency: "DAILY" };
    case "WEEKLY":
      return { frequency: "WEEKLY", weekdays: [defaultWeekday] };
    case "BIWEEKLY":
      return { frequency: "INTERVAL_DAYS", intervalDays: 14 };
    case "MONTHLY":
      return { frequency: "MONTHLY" };
    case "SEASONAL":
      return { frequency: "INTERVAL_DAYS", intervalDays: 90 };
    default:
      return { frequency: "NONE" };
  }
}

export function describeTaskCadence(
  rec?: {
    frequency: TaskRecurrenceFrequency;
    interval_days: number | null;
  } | null,
): string | null {
  if (!rec || rec.frequency === "NONE") return null;
  if (rec.frequency === "DAILY") return "روزانه";
  if (rec.frequency === "WEEKLY") return "هفتگی";
  if (rec.frequency === "MONTHLY") return "ماهانه";
  if (rec.frequency === "YEARLY") return "سالانه";
  if (rec.frequency === "INTERVAL_DAYS") {
    if (rec.interval_days === 14) return "دوهفته‌ای";
    if (rec.interval_days === 90) return "فصلی";
    return `هر ${rec.interval_days ?? 1} روز`;
  }
  return null;
}

export function toggleChecklistItem(
  items: CleaningChecklistItem[],
  itemId: string,
): CleaningChecklistItem[] {
  return items.map((item) =>
    item.id === itemId ? { ...item, done: !item.done } : item,
  );
}

/**
 * Weekly cleaning progress across the current Iranian week [Sat 00:00, next Sat 00:00).
 * Counts cleaning tasks scheduled in this week or overdue open ones, plus ones completed this week.
 */
export function computeWeeklyCleaningProgress(
  tasks: TaskRecord[],
  now: Date = new Date(),
) {
  const { start, end } = getJalaliWeekRange(now);
  const startMs = start.getTime();
  const endMs = end.getTime();
  let completed = 0;
  let pending = 0;

  for (const t of tasks) {
    if (t.task_kind !== "CLEANING" || t.archived_at || t.status === "SKIPPED")
      continue;
    if (t.status === "COMPLETED") {
      const doneMs = t.completed_at ? Date.parse(t.completed_at) : NaN;
      const dueMs = t.due_at ? Date.parse(t.due_at) : NaN;
      if (
        (Number.isFinite(doneMs) && doneMs >= startMs && doneMs < endMs) ||
        (Number.isFinite(dueMs) && dueMs >= startMs && dueMs < endMs)
      ) {
        completed += 1;
      }
      continue;
    }
    const dueMs = t.due_at ? Date.parse(t.due_at) : NaN;
    if (!t.due_at || (Number.isFinite(dueMs) && dueMs < endMs)) {
      pending += 1;
    }
  }

  const total = completed + pending;
  return {
    total,
    completed,
    pending,
    percent: total === 0 ? null : Math.round((completed / total) * 100),
  };
}
