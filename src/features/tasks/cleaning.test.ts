import { describe, expect, it } from "vitest";
import {
  cadenceToRecurrence,
  computeWeeklyCleaningProgress,
  describeTaskCadence,
  toggleChecklistItem,
} from "./cleaning";
import type { TaskRecord } from "./types";

function makeCleaningTask(overrides: Partial<TaskRecord>): TaskRecord {
  return {
    id: "t1",
    title: "نظافت آشپزخانه",
    description: null,
    creator_id: "u1",
    owner_id: "u1",
    household_id: "h1",
    visibility: "HOUSEHOLD_SHARED",
    status: "PENDING",
    priority: "NORMAL",
    due_at: "2026-10-28T10:00:00Z",
    completed_at: null,
    archived_at: null,
    task_kind: "CLEANING",
    cleaning_zone: "KITCHEN",
    cleaning_checklist: [],
    created_at: "2026-10-25T10:00:00Z",
    updated_at: "2026-10-25T10:00:00Z",
    task_assignees: [],
    task_recurrences: null,
    ...overrides,
  };
}

describe("cleaning on existing tasks", () => {
  it("maps biweekly and seasonal cadences onto existing task recurrence frequencies", () => {
    expect(cadenceToRecurrence("BIWEEKLY")).toEqual({
      frequency: "INTERVAL_DAYS",
      intervalDays: 14,
    });
    expect(cadenceToRecurrence("SEASONAL")).toEqual({
      frequency: "INTERVAL_DAYS",
      intervalDays: 90,
    });
    expect(
      describeTaskCadence({ frequency: "INTERVAL_DAYS", interval_days: 14 }),
    ).toBe("دوهفته‌ای");
    expect(
      describeTaskCadence({ frequency: "INTERVAL_DAYS", interval_days: 90 }),
    ).toBe("فصلی");
  });

  it("toggles checklist items without mutating siblings", () => {
    const updated = toggleChecklistItem(
      [
        { id: "a", title: "گاز", done: false },
        { id: "b", title: "سینک", done: true },
      ],
      "a",
    );
    expect(updated).toEqual([
      { id: "a", title: "گاز", done: true },
      { id: "b", title: "سینک", done: true },
    ]);
  });

  it("computes weekly progress honestly and returns null percent when no cleaning tasks exist", () => {
    const now = new Date("2026-10-28T12:00:00");
    expect(computeWeeklyCleaningProgress([], now)).toEqual({
      total: 0,
      completed: 0,
      pending: 0,
      percent: null,
    });

    const progress = computeWeeklyCleaningProgress(
      [
        makeCleaningTask({
          id: "1",
          status: "COMPLETED",
          completed_at: "2026-10-28T08:00:00Z",
        }),
        makeCleaningTask({
          id: "2",
          status: "PENDING",
          due_at: "2026-10-29T08:00:00Z",
        }),
        makeCleaningTask({ id: "3", task_kind: "GENERAL", status: "PENDING" }),
      ],
      now,
    );
    expect(progress).toEqual({
      total: 2,
      completed: 1,
      pending: 1,
      percent: 50,
    });
  });
});
