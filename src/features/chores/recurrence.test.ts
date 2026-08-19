import { describe, expect, it } from "vitest";
import {
  getChoreOccurrenceDates,
  getChoreOccurrenceIndex,
  getRotationAssignee,
} from "./recurrence";

describe("chore recurrence", () => {
  it("generates daily occurrences including start date", () => {
    const result = getChoreOccurrenceDates({
      startDate: "2026-08-20",
      fromDate: "2026-08-20",
      toDate: "2026-08-23",
      recurrence: {
        frequency: "DAILY",
      },
    });

    expect(result).toEqual([
      "2026-08-20",
      "2026-08-21",
      "2026-08-22",
      "2026-08-23",
    ]);
  });

  it("generates interval-day occurrences", () => {
    const result = getChoreOccurrenceDates({
      startDate: "2026-08-20",
      fromDate: "2026-08-20",
      toDate: "2026-08-27",
      recurrence: {
        frequency: "INTERVAL_DAYS",
        intervalDays: 3,
      },
    });

    expect(result).toEqual([
      "2026-08-20",
      "2026-08-23",
      "2026-08-26",
    ]);
  });

  it("generates weekly occurrences for selected weekdays", () => {
    const result = getChoreOccurrenceDates({
      startDate: "2026-08-20",
      fromDate: "2026-08-20",
      toDate: "2026-08-31",
      recurrence: {
        frequency: "WEEKLY",
        weekdays: [1, 4],
      },
    });

    expect(result).toEqual([
      "2026-08-20",
      "2026-08-24",
      "2026-08-27",
      "2026-08-31",
    ]);
  });

  it("clamps monthly recurrence to the final day of shorter months", () => {
    const result = getChoreOccurrenceDates({
      startDate: "2026-01-31",
      fromDate: "2026-01-01",
      toDate: "2026-04-30",
      recurrence: {
        frequency: "MONTHLY",
      },
    });

    expect(result).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-28",
      "2026-04-28",
    ]);
  });

  it("handles leap-day yearly recurrence", () => {
    const result = getChoreOccurrenceDates({
      startDate: "2024-02-29",
      fromDate: "2024-02-29",
      toDate: "2027-03-01",
      recurrence: {
        frequency: "YEARLY",
      },
    });

    expect(result).toEqual([
      "2024-02-29",
      "2025-02-28",
      "2026-02-28",
      "2027-02-28",
    ]);
  });

  it("calculates deterministic occurrence index", () => {
    expect(
      getChoreOccurrenceIndex({
        startDate: "2026-08-20",
        occurrenceDate: "2026-08-26",
        recurrence: {
          frequency: "INTERVAL_DAYS",
          intervalDays: 3,
        },
      }),
    ).toBe(2);
  });
});

describe("chore rotation", () => {
  const rotation = [
    {
      userId: "user-b",
      position: 1,
    },
    {
      userId: "user-a",
      position: 0,
    },
  ];

  it("assigns members using round-robin order", () => {
    expect(
      getRotationAssignee({
        rotation,
        occurrenceIndex: 0,
      }),
    ).toBe("user-a");

    expect(
      getRotationAssignee({
        rotation,
        occurrenceIndex: 1,
      }),
    ).toBe("user-b");

    expect(
      getRotationAssignee({
        rotation,
        occurrenceIndex: 2,
      }),
    ).toBe("user-a");
  });

  it("falls back to default assignee without rotation", () => {
    expect(
      getRotationAssignee({
        rotation: [],
        occurrenceIndex: 0,
        defaultAssigneeId: "default-user",
      }),
    ).toBe("default-user");
  });

  it("returns null for invalid occurrence index", () => {
    expect(
      getRotationAssignee({
        rotation,
        occurrenceIndex: -1,
      }),
    ).toBeNull();
  });
});
