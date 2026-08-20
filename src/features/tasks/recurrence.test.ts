import { describe, expect, it } from "vitest";
import { getNextOccurrence } from "@/features/tasks/recurrence";

describe("task recurrence", () => {
  it("calculates next daily occurrence", () => {
    const next = getNextOccurrence({
      from: new Date("2026-01-10T10:00:00.000Z"),
      recurrence: {
        frequency: "DAILY",
      },
    });

    expect(next?.toISOString().slice(0, 10)).toBe("2026-01-11");
  });

  it("calculates weekly next occurrence from selected weekdays", () => {
    const next = getNextOccurrence({
      from: new Date("2026-01-10T10:00:00.000Z"),
      recurrence: {
        frequency: "WEEKLY",
        weekdays: [1, 4],
      },
    });

    expect(next?.getUTCDay()).toBe(1);
    expect(next?.toISOString().slice(0, 10)).toBe("2026-01-12");
  });
});
