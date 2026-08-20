import {
  getChoreOccurrenceDates,
  getChoreOccurrenceIndex,
  getRotationAssignee,
} from "@/features/chores/recurrence";
import type { ChoreFrequency, ChoreRecurrence } from "@/features/chores/types";

export type CalendarChoreSource = {
  id: string;
  title: string;
  description: string | null;
  isActive: boolean;
  startDate: string;
  defaultAssigneeId: string | null;
  frequency: ChoreFrequency;
  intervalDays: number | null;
  weekdays: number[] | null;
  rotationUserIds: string[];
  completedDates: string[];
};

export type CalendarChoreItem = {
  choreId: string;
  title: string;
  description: string | null;
  forDate: string;
  assignedTo: string | null;
  completed: boolean;
};

function toRecurrence(source: CalendarChoreSource): ChoreRecurrence {
  return {
    frequency: source.frequency,
    intervalDays: source.intervalDays,
    weekdays: source.weekdays,
  };
}

/** Expand active chores into occurrence rows inside [fromDate, toDate] (inclusive, YYYY-MM-DD). */
export function buildCalendarChoreItems(
  sources: CalendarChoreSource[],
  fromDate: string,
  toDate: string,
): CalendarChoreItem[] {
  const items: CalendarChoreItem[] = [];

  for (const source of sources) {
    if (!source.isActive) continue;

    const recurrence = toRecurrence(source);
    const completed = new Set(source.completedDates);

    const dates = getChoreOccurrenceDates({
      startDate: source.startDate,
      fromDate,
      toDate,
      recurrence,
    });

    const rotation = source.rotationUserIds.map((userId, position) => ({
      userId,
      position,
    }));

    for (const forDate of dates) {
      const occurrenceIndex = getChoreOccurrenceIndex({
        startDate: source.startDate,
        occurrenceDate: forDate,
        recurrence,
      });

      if (occurrenceIndex === null) continue;

      const assignedTo = getRotationAssignee({
        rotation,
        occurrenceIndex,
        defaultAssigneeId: source.defaultAssigneeId,
      });

      items.push({
        choreId: source.id,
        title: source.title,
        description: source.description,
        forDate,
        assignedTo,
        completed: completed.has(forDate),
      });
    }
  }

  items.sort((a, b) => {
    if (a.forDate !== b.forDate) return a.forDate < b.forDate ? -1 : 1;
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return a.title.localeCompare(b.title, "fa");
  });

  return items;
}

export function dateOnlyToLocalDate(dateOnly: string): Date {
  const [y, m, d] = dateOnly.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function toDateOnlyLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDaysDateOnly(dateOnly: string, days: number): string {
  const [y, m, d] = dateOnly.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}
