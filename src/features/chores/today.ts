import {
  getChoreOccurrenceDates,
  getChoreOccurrenceIndex,
  getRotationAssignee,
} from "@/features/chores/recurrence";
import type { ChoreFrequency, ChoreRecurrence } from "@/features/chores/types";

export type TodayChoreSource = {
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
  completedDates: Set<string>;
};

export type TodayChoreItem = {
  choreId: string;
  title: string;
  description: string | null;
  forDate: string;
  assignedTo: string | null;
  completed: boolean;
  overdue: boolean;
};

function toDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(dateOnly: string, days: number): string {
  const [y, m, d] = dateOnly.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function toRecurrence(chore: TodayChoreSource): ChoreRecurrence {
  return {
    frequency: chore.frequency,
    intervalDays: chore.intervalDays,
    weekdays: chore.weekdays,
  };
}

function resolveAssignee(
  rotationUserIds: string[],
  occurrenceIndex: number,
  defaultAssigneeId: string | null,
): string | null {
  if (rotationUserIds.length === 0) return defaultAssigneeId;

  try {
    // common signature A: (userIds, index)
    const a = (getRotationAssignee as Function)(rotationUserIds, occurrenceIndex);
    if (typeof a === "string") return a;
  } catch {
    // ignore
  }

  try {
    // common signature B: ({ rotation / members, occurrenceIndex })
    const b = (getRotationAssignee as Function)({
      rotationUserIds,
      occurrenceIndex,
    });
    if (typeof b === "string") return b;
  } catch {
    // ignore
  }

  try {
    const c = (getRotationAssignee as Function)({
      rotation: rotationUserIds.map((userId, position) => ({ userId, position })),
      occurrenceIndex,
    });
    if (typeof c === "string") return c;
  } catch {
    // ignore
  }

  const idx =
    ((occurrenceIndex % rotationUserIds.length) + rotationUserIds.length) %
    rotationUserIds.length;
  return rotationUserIds[idx] ?? defaultAssigneeId;
}

function resolveOccurrenceIndex(
  startDate: string,
  occurrenceDate: string,
  recurrence: ChoreRecurrence,
): number {
  try {
    const value = (getChoreOccurrenceIndex as Function)({
      startDate,
      occurrenceDate,
      recurrence,
    });
    if (typeof value === "number" && Number.isFinite(value)) return value;
  } catch {
    // ignore
  }

  try {
    const value = (getChoreOccurrenceIndex as Function)(
      startDate,
      occurrenceDate,
      recurrence,
    );
    if (typeof value === "number" && Number.isFinite(value)) return value;
  } catch {
    // ignore
  }

  return 0;
}

/** Build today + overdue (last 14 days) incomplete occurrences */
export function buildTodayChoreItems(
  chores: TodayChoreSource[],
  today = toDateOnly(new Date()),
  overdueLookbackDays = 14,
): TodayChoreItem[] {
  const rangeStart = addDays(today, -overdueLookbackDays);
  const items: TodayChoreItem[] = [];

  for (const chore of chores) {
    if (!chore.isActive) continue;

    const recurrence = toRecurrence(chore);

    const dates = getChoreOccurrenceDates({
      startDate: chore.startDate,
      fromDate: rangeStart,
      toDate: today,
      recurrence,
    });

    for (const forDate of dates) {
      const completed = chore.completedDates.has(forDate);
      const overdue = forDate < today && !completed;
      const isToday = forDate === today;

      if (!isToday && !overdue) continue;

      const occurrenceIndex = resolveOccurrenceIndex(
        chore.startDate,
        forDate,
        recurrence,
      );

      const assignedTo = resolveAssignee(
        chore.rotationUserIds,
        occurrenceIndex,
        chore.defaultAssigneeId,
      );

      items.push({
        choreId: chore.id,
        title: chore.title,
        description: chore.description,
        forDate,
        assignedTo,
        completed,
        overdue,
      });
    }
  }

  items.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.forDate !== b.forDate) return a.forDate < b.forDate ? -1 : 1;
    return a.title.localeCompare(b.title, "fa");
  });

  return items;
}

export function toDateOnlyLocal(d = new Date()) {
  return toDateOnly(d);
}
