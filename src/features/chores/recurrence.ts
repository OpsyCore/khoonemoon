import type { ChoreRecurrence, ChoreRotationMember } from "./types";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(date: string): Date {
  if (!DATE_PATTERN.test(date)) {
    throw new Error("INVALID_DATE");
  }

  const [year, month, day] = date.split("-").map(Number);

  const result = new Date(Date.UTC(year, month - 1, day));

  if (
    result.getUTCFullYear() !== year ||
    result.getUTCMonth() !== month - 1 ||
    result.getUTCDate() !== day
  ) {
    throw new Error("INVALID_DATE");
  }

  return result;
}

function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function addMonths(date: Date, months: number): Date {
  const originalDay = date.getUTCDate();

  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1),
  );

  const lastDayOfTargetMonth = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();

  target.setUTCDate(Math.min(originalDay, lastDayOfTargetMonth));

  return target;
}

function addYears(date: Date, years: number): Date {
  const targetYear = date.getUTCFullYear() + years;
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  const result = new Date(Date.UTC(targetYear, month, 1));

  const lastDayOfMonth = new Date(
    Date.UTC(targetYear, month + 1, 0),
  ).getUTCDate();

  result.setUTCDate(Math.min(day, lastDayOfMonth));

  return result;
}

function isOccurrenceDate({
  start,
  candidate,
  recurrence,
}: {
  start: Date;
  candidate: Date;
  recurrence: ChoreRecurrence;
}): boolean {
  if (candidate < start) {
    return false;
  }

  const dayDifference = Math.floor(
    (candidate.getTime() - start.getTime()) / (24 * 60 * 60 * 1000),
  );

  switch (recurrence.frequency) {
    case "NONE":
      return dayDifference === 0;

    case "DAILY":
      return true;

    case "INTERVAL_DAYS": {
      const interval = recurrence.intervalDays ?? 1;

      if (interval <= 0) {
        return false;
      }

      return dayDifference % interval === 0;
    }

    case "WEEKLY": {
      const weekdays = recurrence.weekdays ?? [];

      return weekdays.includes(candidate.getUTCDay());
    }

    case "MONTHLY": {
      let current = new Date(start);

      while (current <= candidate) {
        if (formatDate(current) === formatDate(candidate)) {
          return true;
        }

        current = addMonths(current, 1);
      }

      return false;
    }

    case "YEARLY": {
      let current = new Date(start);

      while (current <= candidate) {
        if (formatDate(current) === formatDate(candidate)) {
          return true;
        }

        current = addYears(current, 1);
      }

      return false;
    }

    default:
      return false;
  }
}

export function getChoreOccurrenceDates({
  startDate,
  fromDate,
  toDate,
  recurrence,
}: {
  startDate: string;
  fromDate: string;
  toDate: string;
  recurrence: ChoreRecurrence;
}): string[] {
  const start = parseDate(startDate);
  const from = parseDate(fromDate);
  const to = parseDate(toDate);

  if (to < from) {
    return [];
  }

  const rangeStart = from < start ? start : from;

  const result: string[] = [];

  for (
    let candidate = new Date(rangeStart);
    candidate <= to;
    candidate = addDays(candidate, 1)
  ) {
    if (
      isOccurrenceDate({
        start,
        candidate,
        recurrence,
      })
    ) {
      result.push(formatDate(candidate));
    }
  }

  return result;
}

export function getChoreOccurrenceIndex({
  startDate,
  occurrenceDate,
  recurrence,
}: {
  startDate: string;
  occurrenceDate: string;
  recurrence: ChoreRecurrence;
}): number | null {
  const occurrences = getChoreOccurrenceDates({
    startDate,
    fromDate: startDate,
    toDate: occurrenceDate,
    recurrence,
  });

  const index = occurrences.indexOf(occurrenceDate);

  return index >= 0 ? index : null;
}

export function getRotationAssignee({
  rotation,
  occurrenceIndex,
  defaultAssigneeId = null,
}: {
  rotation: ChoreRotationMember[];
  occurrenceIndex: number;
  defaultAssigneeId?: string | null;
}): string | null {
  if (rotation.length === 0) {
    return defaultAssigneeId;
  }

  if (!Number.isInteger(occurrenceIndex) || occurrenceIndex < 0) {
    return null;
  }

  const ordered = [...rotation].sort((a, b) => a.position - b.position);

  return ordered[occurrenceIndex % ordered.length]?.userId ?? null;
}
