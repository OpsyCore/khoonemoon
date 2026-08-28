import { describe, expect, it } from "vitest";
import { getNextOccurrence } from "@/features/tasks/recurrence";

describe("task recurrence", () => {
  it("returns null for NONE and unknown frequencies", () => {
    expect(
      getNextOccurrence({
        from: new Date("2026-01-10T10:00:00.000Z"),
        recurrence: { frequency: "NONE" },
      }),
    ).toBeNull();

    expect(
      getNextOccurrence({
        from: new Date("2026-01-10T10:00:00.000Z"),
        recurrence: { frequency: "CUSTOM" as never },
      }),
    ).toBeNull();
  });

  it("calculates next daily occurrence from the UTC start of day", () => {
    const next = getNextOccurrence({
      from: new Date("2026-01-10T10:00:00.000Z"),
      recurrence: { frequency: "DAILY" },
    });

    expect(next?.toISOString()).toBe("2026-01-11T00:00:00.000Z");
  });

  it("uses intervalDays for INTERVAL_DAYS and defaults missing interval to 1", () => {
    const everyThree = getNextOccurrence({
      from: new Date("2026-01-10T10:00:00.000Z"),
      recurrence: { frequency: "INTERVAL_DAYS", intervalDays: 3 },
    });
    expect(everyThree?.toISOString().slice(0, 10)).toBe("2026-01-13");

    const missingInterval = getNextOccurrence({
      from: new Date("2026-01-10T10:00:00.000Z"),
      recurrence: { frequency: "INTERVAL_DAYS" },
    });
    expect(missingInterval?.toISOString().slice(0, 10)).toBe("2026-01-11");
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

  it("returns null for weekly recurrence without weekdays", () => {
    expect(
      getNextOccurrence({
        from: new Date("2026-01-10T10:00:00.000Z"),
        recurrence: { frequency: "WEEKLY", weekdays: [] },
      }),
    ).toBeNull();

    expect(
      getNextOccurrence({
        from: new Date("2026-01-10T10:00:00.000Z"),
        recurrence: { frequency: "WEEKLY" },
      }),
    ).toBeNull();
  });

  it("advances monthly and yearly from the UTC calendar date", () => {
    const monthly = getNextOccurrence({
      from: new Date("2026-01-10T10:00:00.000Z"),
      recurrence: { frequency: "MONTHLY" },
    });
    expect(monthly?.toISOString().slice(0, 10)).toBe("2026-02-10");

    const yearly = getNextOccurrence({
      from: new Date("2026-01-10T10:00:00.000Z"),
      recurrence: { frequency: "YEARLY" },
    });
    expect(yearly?.toISOString().slice(0, 10)).toBe("2027-01-10");
  });
});
