import { toDateTimeLocal } from "@/features/quick-add/payload";

/** Preserve the exact instant and its recurrence zone unless the due field changed. */
export function taskEditTime(
  input: string,
  originalDue: string | null,
  originalZone: string | null | undefined,
  deviceZone: string,
): { dueAt: string | null; recurrenceTimezone: string } {
  const originalInput = originalDue
    ? toDateTimeLocal(new Date(originalDue))
    : "";
  if (input === originalInput) {
    return {
      dueAt: originalDue?.endsWith("+00:00")
        ? originalDue.slice(0, -6) + "Z"
        : originalDue,
      recurrenceTimezone: originalZone || deviceZone,
    };
  }
  if (!input) return { dueAt: null, recurrenceTimezone: deviceZone };
  const chosen = new Date(input);
  if (!Number.isFinite(chosen.getTime()) || toDateTimeLocal(chosen) !== input) {
    throw new Error("زمان انتخاب‌شده در منطقه زمانی این دستگاه وجود ندارد.");
  }
  return { dueAt: chosen.toISOString(), recurrenceTimezone: deviceZone };
}
