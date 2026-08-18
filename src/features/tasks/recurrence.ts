import type { TaskRecurrence } from "@/features/tasks/types";

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function getNextOccurrence({
  from,
  recurrence,
}: {
  from: Date;
  recurrence: TaskRecurrence;
}) {
  const base = startOfDay(from);

  switch (recurrence.frequency) {
    case "NONE":
      return null;
    case "DAILY": {
      const result = new Date(base);
      result.setDate(result.getDate() + 1);
      return result;
    }
    case "INTERVAL_DAYS": {
      const result = new Date(base);
      result.setDate(result.getDate() + (recurrence.intervalDays ?? 1));
      return result;
    }
    case "WEEKLY": {
      const weekdays = recurrence.weekdays ?? [];
      if (!weekdays.length) return null;
      const currentWeekday = base.getDay();

      for (let offset = 1; offset <= 14; offset += 1) {
        const candidate = new Date(base);
        candidate.setDate(candidate.getDate() + offset);
        if (weekdays.includes(candidate.getDay())) {
          return candidate;
        }
      }

      return null;
    }
    case "MONTHLY": {
      const result = new Date(base);
      result.setMonth(result.getMonth() + 1);
      return result;
    }
    case "YEARLY": {
      const result = new Date(base);
      result.setFullYear(result.getFullYear() + 1);
      return result;
    }
    default:
      return null;
  }
}
