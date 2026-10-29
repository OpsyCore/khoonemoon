import { describe, expect, it } from "vitest";

import {
  buildWeeklySummary,
  buildWeeklyWindows,
  changePercent,
  isWithin,
} from "./weekly-summary";

const NOW = new Date("2026-03-20T12:00:00.000Z");
const DAY = 86_400_000;

function daysAgo(days: number) {
  return new Date(NOW.getTime() - days * DAY).toISOString();
}

function record(
  overrides: Partial<{
    record_type: "EXPENSE" | "INCOME" | "BILL";
    amount: number | string;
    paid_at: string | null;
    occurred_at: string;
  }> = {},
) {
  return {
    record_type: "EXPENSE" as const,
    amount: 100,
    paid_at: null,
    occurred_at: daysAgo(1),
    ...overrides,
  };
}

describe("buildWeeklyWindows", () => {
  it("puts the last seven days in `current` and the seven before in `previous`", () => {
    const { current, previous } = buildWeeklyWindows(NOW);

    expect(current.to).toEqual(NOW);
    expect(current.from.toISOString()).toBe(daysAgo(7));
    expect(previous.to).toEqual(current.from);
    expect(previous.from.toISOString()).toBe(daysAgo(14));
  });

  it("makes the two windows share a boundary without overlapping", () => {
    const { current, previous } = buildWeeklyWindows(NOW);
    const boundary = new Date(current.from);

    expect(isWithin(boundary, current)).toBe(true);
    expect(isWithin(boundary, previous)).toBe(false);
  });
});

describe("isWithin", () => {
  it("rejects a missing or unparsable date instead of counting it", () => {
    const { current } = buildWeeklyWindows(NOW);

    expect(isWithin(null, current)).toBe(false);
    expect(isWithin(new Date("not-a-date"), current)).toBe(false);
  });
});

describe("changePercent", () => {
  it("returns null when last week had nothing to compare against", () => {
    expect(changePercent(500, 0)).toBeNull();
  });

  it("reports a rise, a fall and a flat week", () => {
    expect(changePercent(150, 100)).toBe(50);
    expect(changePercent(50, 100)).toBe(-50);
    expect(changePercent(100, 100)).toBe(0);
  });
});

describe("buildWeeklySummary", () => {
  it("counts completed tasks per window and ignores the other week", () => {
    const summary = buildWeeklySummary({
      tasks: [
        { completed_at: new Date(NOW.getTime() - 60_000).toISOString() },
        { completed_at: daysAgo(6) },
        { completed_at: daysAgo(8) },
        { completed_at: null },
      ],
      chores: [],
      finance: [],
      now: NOW,
    });

    expect(summary.tasksDone).toBe(2);
    expect(summary.tasksDonePrevious).toBe(1);
  });

  it("treats the window as half-open so an edge task is never counted twice", () => {
    const summary = buildWeeklySummary({
      tasks: [
        // exactly at `from` — inside this week
        { completed_at: daysAgo(7) },
        // exactly at `to` — the boundary belongs to the next window
        { completed_at: NOW.toISOString() },
      ],
      chores: [],
      finance: [],
      now: NOW,
    });

    expect(summary.tasksDone).toBe(1);
    expect(summary.tasksDonePrevious).toBe(0);
  });

  it("sums only money that moved inside the window", () => {
    const summary = buildWeeklySummary({
      tasks: [],
      chores: [],
      finance: [
        record({ amount: 1000, occurred_at: daysAgo(2) }),
        record({ amount: 500, occurred_at: daysAgo(10) }),
        record({ amount: 9000, occurred_at: daysAgo(40) }),
      ],
      now: NOW,
    });

    expect(summary.spent).toBe(1000);
    expect(summary.spentPrevious).toBe(500);
  });

  it("treats an unpaid bill's due date as irrelevant, like the ledger does", () => {
    // A bill recorded last month but paid two days ago is *this week's* spending.
    const summary = buildWeeklySummary({
      tasks: [],
      chores: [],
      finance: [
        record({
          record_type: "BILL",
          amount: 2000,
          occurred_at: daysAgo(30),
          paid_at: daysAgo(2),
        }),
      ],
      now: NOW,
    });

    expect(summary.spent).toBe(2000);
  });

  it("separates income from spending so a salary does not look like a cost", () => {
    const summary = buildWeeklySummary({
      tasks: [],
      chores: [],
      finance: [
        record({ record_type: "INCOME", amount: 50_000_000 }),
        record({ amount: 1_200_000 }),
      ],
      now: NOW,
    });

    expect(summary.earned).toBe(50_000_000);
    expect(summary.spent).toBe(1_200_000);
  });

  it("reads numeric strings from Postgres without producing NaN", () => {
    const summary = buildWeeklySummary({
      tasks: [],
      chores: [],
      finance: [record({ amount: "2500" }), record({ amount: "0" })],
      now: NOW,
    });

    expect(summary.spent).toBe(2500);
  });

  it("counts chores on their own line", () => {
    const summary = buildWeeklySummary({
      tasks: [],
      chores: [
        { completed_at: daysAgo(1) },
        { completed_at: daysAgo(3) },
        { completed_at: daysAgo(9) },
      ],
      finance: [],
      now: NOW,
    });

    expect(summary.choresDone).toBe(2);
    expect(summary.choresDonePrevious).toBe(1);
  });

  it("leaves the change unknown on a first week with no history", () => {
    const summary = buildWeeklySummary({
      tasks: [],
      chores: [],
      finance: [record({ amount: 800 })],
      now: NOW,
    });

    expect(summary.spent).toBe(800);
    expect(summary.spentChange).toBeNull();
  });
});
