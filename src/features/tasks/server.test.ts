import { describe, expect, it } from "vitest";
import { recurrenceToRow } from "@/features/tasks/server";

describe("task server helpers", () => {
  it("does not persist a NONE recurrence row", () => {
    expect(
      recurrenceToRow({
        dueAt: "2026-08-28T10:00:00.000Z",
        recurrence: { frequency: "NONE" },
      }),
    ).toBeNull();
  });

  it("stores the next daily occurrence from dueAt", () => {
    expect(
      recurrenceToRow({
        dueAt: "2026-08-28T10:00:00.000Z",
        recurrence: { frequency: "DAILY" },
      }),
    ).toEqual({
      frequency: "DAILY",
      interval_days: null,
      weekdays: null,
      next_occurrence_at: "2026-08-29T00:00:00.000Z",
    });
  });

  it("stores interval and weekdays when present", () => {
    const row = recurrenceToRow({
      dueAt: "2026-08-28T10:00:00.000Z",
      recurrence: {
        frequency: "WEEKLY",
        weekdays: [1, 4],
      },
    });

    expect(row?.frequency).toBe("WEEKLY");
    expect(row?.weekdays).toEqual([1, 4]);
    expect(row?.next_occurrence_at).toBeTruthy();
  });
});
