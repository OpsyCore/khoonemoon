import type { TaskRecurrence } from "@/features/tasks/types";

function startOfDayUtc(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function getNextOccurrence({
  from,
  recurrence,
}: {
  from: Date;
  recurrence: TaskRecurrence;
}) {
  const base = startOfDayUtc(from);

  switch (recurrence.frequency) {
    case "NONE":
      return null;

    case "DAILY": {
      const result = new Date(base);
      result.setUTCDate(result.getUTCDate() + 1);
      return result;
    }

    case "INTERVAL_DAYS": {
      const result = new Date(base);
      result.setUTCDate(result.getUTCDate() + (recurrence.intervalDays ?? 1));
      return result;
    }

    case "WEEKLY": {
      const weekdays = recurrence.weekdays ?? [];

      if (!weekdays.length) {
        return null;
      }

      for (let offset = 1; offset <= 14; offset += 1) {
        const candidate = new Date(base);
        candidate.setUTCDate(candidate.getUTCDate() + offset);

        if (weekdays.includes(candidate.getUTCDay())) {
          return candidate;
        }
      }

      return null;
    }

    case "MONTHLY": {
      const result = new Date(base);
      result.setUTCMonth(result.getUTCMonth() + 1);
      return result;
    }

    case "YEARLY": {
      const result = new Date(base);
      result.setUTCFullYear(result.getUTCFullYear() + 1);
      return result;
    }

    default:
      return null;
  }
}
