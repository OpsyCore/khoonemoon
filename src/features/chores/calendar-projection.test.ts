import { describe, expect, it } from "vitest";
import {
  nextProjectedDue,
  projectChoreDates,
  type CalendarChore,
} from "./calendar-projection";
const chore: CalendarChore = {
  id: "x",
  title: "test",
  next_due_at: "2026-01-31T15:00:00Z",
  frequency: "MONTHLY",
  interval_days: null,
  weekdays: null,
};
describe("chore calendar projection", () => {
  it("clamps month ends like Postgres", () => {
    expect(
      nextProjectedDue(new Date(chore.next_due_at), chore)?.toISOString(),
    ).toBe("2026-02-28T00:00:00.000Z");
  });
  it("selects the next configured weekday and respects half-open windows", () => {
    const weekly: CalendarChore = {
      ...chore,
      next_due_at: "2026-03-01T09:00:00Z",
      frequency: "WEEKLY",
      weekdays: [2, 4],
    };
    const dates = projectChoreDates(
      weekly,
      new Date("2026-03-01T00:00:00Z"),
      new Date("2026-03-06T00:00:00Z"),
    );
    expect(dates.map((x) => x.due.toISOString().slice(0, 10))).toEqual([
      "2026-03-01",
      "2026-03-03",
      "2026-03-05",
    ]);
    expect(dates.map((x) => x.current)).toEqual([true, false, false]);
  });
  it("does not project one-time chores", () => {
    expect(
      projectChoreDates(
        { ...chore, frequency: "NONE" },
        new Date("2026-01-01Z"),
        new Date("2027-01-01Z"),
      ),
    ).toHaveLength(1);
  });
});
