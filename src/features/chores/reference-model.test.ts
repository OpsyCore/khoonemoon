import { expect, it } from "vitest";
import { choreDashboardModel, dueLabel, weekStart } from "./reference-model";
import type { ChoreRecord } from "./types";
const row = (
  id: string,
  due: Date,
  who: string,
  active = true,
): ChoreRecord => ({
  id,
  household_id: "house",
  title: id,
  description: null,
  created_by: who,
  rotation_mode: "FIXED",
  current_rotation_index: 0,
  frequency: "DAILY",
  recurrence_timezone: "UTC",
  interval_days: null,
  weekdays: null,
  next_due_at: due.toISOString(),
  is_active: active,
  archived_at: null,
  created_at: due.toISOString(),
  updated_at: due.toISOString(),
  completion_revision: 0,
  chore_rotation_steps: [
    { id: `step-${id}`, chore_id: id, position: 0, assignee_id: who },
  ],
});
it("counts only the local Saturday-to-now week, including departed members and zero counts", () => {
  const now = new Date(2026, 10, 4, 12);
  const start = weekStart(now);
  expect(start.getDay()).toBe(6);
  expect(start.getHours()).toBe(0);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const future = new Date(now);
  future.setDate(now.getDate() + 1);
  const history = [
    {
      id: "1",
      chore_id: "a",
      completed_by: "a",
      completed_at: yesterday.toISOString(),
      due_at: null,
      note: null,
      chores: { id: "a", title: "a" },
    },
    {
      id: "2",
      chore_id: "a",
      completed_by: "former",
      completed_at: now.toISOString(),
      due_at: null,
      note: null,
      chores: { id: "a", title: "a" },
    },
    {
      id: "3",
      chore_id: "a",
      completed_by: "b",
      completed_at: future.toISOString(),
      due_at: null,
      note: null,
      chores: { id: "a", title: "a" },
    },
    {
      id: "4",
      chore_id: "a",
      completed_by: "a",
      completed_at: new Date(start.getTime() - 1).toISOString(),
      due_at: null,
      note: null,
      chores: { id: "a", title: "a" },
    },
  ];
  const model = choreDashboardModel(
    [
      row("today", now, "a"),
      row("overdue", yesterday, "b"),
      row("future", future, "b"),
      row("paused", now, "a", false),
    ],
    history,
    [
      { id: "a", full_name: "سارا" },
      { id: "b", full_name: "علی" },
    ],
    now,
  );
  expect(model.today.map((c) => c.id)).toEqual(["today"]);
  expect(model.due.map((c) => c.id)).toEqual(["today", "overdue"]);
  expect(model.upcoming.map((c) => c.id)).toEqual(["future"]);
  expect(model.assignedNames).toEqual(["سارا"]);
  expect(model.total).toBe(2);
  expect(model.shares).toEqual([
    { id: "a", name: "سارا", count: 1, percent: 50 },
    { id: "b", name: "علی", count: 0, percent: 0 },
    { id: "former", name: "عضو سابق خانه", count: 1, percent: 50 },
  ]);
  expect(dueLabel(future.toISOString(), now)).toBe("فردا");
  expect(dueLabel(yesterday.toISOString(), now)).toBe("عقب‌افتاده");
});
