import { describe, expect, it } from "vitest";
import {
  choreRecurrenceToRow,
  getChoreOccurrencesInRange,
  resolveChoreAssignment,
  rotationToRows,
} from "./server";

describe("chore server helpers", () => {
  it("maps recurrence to database row", () => {
    expect(
      choreRecurrenceToRow({
        frequency: "WEEKLY",
        weekdays: [1, 4],
      }),
    ).toEqual({
      frequency: "WEEKLY",
      interval_days: null,
      weekdays: [1, 4],
    });
  });

  it("maps rotation users to ordered rows", () => {
    expect(
      rotationToRows({
        choreId: "chore-1",
        userIds: ["user-a", "user-b"],
      }),
    ).toEqual([
      {
        chore_id: "chore-1",
        user_id: "user-a",
        position: 0,
      },
      {
        chore_id: "chore-1",
        user_id: "user-b",
        position: 1,
      },
    ]);
  });

  it("resolves round-robin assignment", () => {
    expect(
      resolveChoreAssignment({
        startDate: "2026-08-20",
        forDate: "2026-08-22",
        recurrence: {
          frequency: "DAILY",
        },
        rotation: [
          {
            userId: "user-a",
            position: 0,
          },
          {
            userId: "user-b",
            position: 1,
          },
        ],
        defaultAssigneeId: null,
      }),
    ).toEqual({
      occurrenceIndex: 2,
      assignedTo: "user-a",
    });
  });

  it("rejects completion for a non-occurrence date", () => {
    expect(() =>
      resolveChoreAssignment({
        startDate: "2026-08-20",
        forDate: "2026-08-21",
        recurrence: {
          frequency: "INTERVAL_DAYS",
          intervalDays: 2,
        },
        rotation: [],
        defaultAssigneeId: "user-a",
      }),
    ).toThrow("NOT_A_CHORE_OCCURRENCE");
  });

  it("builds occurrences with completion state", () => {
    const result = getChoreOccurrencesInRange({
      choreId: "chore-1",
      startDate: "2026-08-20",
      fromDate: "2026-08-20",
      toDate: "2026-08-22",
      recurrence: {
        frequency: "DAILY",
      },
      rotation: [
        {
          userId: "user-a",
          position: 0,
        },
        {
          userId: "user-b",
          position: 1,
        },
      ],
      defaultAssigneeId: null,
      completedDates: new Set(["2026-08-21"]),
    });

    expect(result).toEqual([
      {
        choreId: "chore-1",
        forDate: "2026-08-20",
        occurrenceIndex: 0,
        assignedTo: "user-a",
        completed: false,
      },
      {
        choreId: "chore-1",
        forDate: "2026-08-21",
        occurrenceIndex: 1,
        assignedTo: "user-b",
        completed: true,
      },
      {
        choreId: "chore-1",
        forDate: "2026-08-22",
        occurrenceIndex: 2,
        assignedTo: "user-a",
        completed: false,
      },
    ]);
  });
});
