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
  recurrence_timezone: "UTC",
};
describe("chore calendar projection", () => {
  it("clamps month ends like Postgres", () => {
    expect(
      nextProjectedDue(new Date(chore.next_due_at), chore)?.toISOString(),
    ).toBe("2026-02-28T15:00:00.000Z");
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
  it("uses the saved local weekday and preserves wall time across DST", () => {
    const weekly = {
      ...chore,
      recurrence_timezone: "America/New_York",
      frequency: "WEEKLY" as const,
      weekdays: [0],
    };
    expect(
      nextProjectedDue(new Date("2026-03-01T14:00:00Z"), weekly)?.toISOString(),
    ).toBe("2026-03-08T13:00:00.000Z");
    const tehran = {
      ...weekly,
      recurrence_timezone: "Asia/Tehran",
      weekdays: [0],
    };
    expect(
      nextProjectedDue(new Date("2026-01-03T21:30:00Z"), tehran)?.toISOString(),
    ).toBe("2026-01-10T21:30:00.000Z");
  });
  it("matches PostgreSQL gap and fold disambiguation", () => {
    const daily = {
      ...chore,
      recurrence_timezone: "America/New_York",
      frequency: "DAILY" as const,
    };
    expect(
      nextProjectedDue(new Date("2026-03-07T07:30:00Z"), daily)?.toISOString(),
    ).toBe("2026-03-08T07:30:00.000Z");
    expect(
      nextProjectedDue(new Date("2026-10-31T05:30:00Z"), daily)?.toISOString(),
    ).toBe("2026-11-01T06:30:00.000Z");
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
