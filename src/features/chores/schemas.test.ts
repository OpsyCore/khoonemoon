import { describe, expect, it } from "vitest";
import {
  choreRecurrenceSchema,
  completeChoreSchema,
  createChoreSchema,
} from "./schemas";

describe("chore schemas", () => {
  it("accepts a valid daily chore", () => {
    const result = createChoreSchema.safeParse({
      title: "شستن ظرف‌ها",
      description: null,
      startDate: "2026-08-20",
      defaultAssigneeId: null,
      recurrence: {
        frequency: "DAILY",
      },
      rotationUserIds: [],
    });

    expect(result.success).toBe(true);
  });

  it("requires intervalDays for INTERVAL_DAYS", () => {
    const result = choreRecurrenceSchema.safeParse({
      frequency: "INTERVAL_DAYS",
    });

    expect(result.success).toBe(false);
  });

  it("requires weekdays for WEEKLY", () => {
    const result = choreRecurrenceSchema.safeParse({
      frequency: "WEEKLY",
      weekdays: [],
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid weekday values", () => {
    const result = choreRecurrenceSchema.safeParse({
      frequency: "WEEKLY",
      weekdays: [1, 7],
    });

    expect(result.success).toBe(false);
  });

  it("rejects duplicate weekdays", () => {
    const result = choreRecurrenceSchema.safeParse({
      frequency: "WEEKLY",
      weekdays: [1, 1],
    });

    expect(result.success).toBe(false);
  });

  it("validates completion date format", () => {
    expect(
      completeChoreSchema.safeParse({
        forDate: "2026-08-20",
      }).success,
    ).toBe(true);

    expect(
      completeChoreSchema.safeParse({
        forDate: "20/08/2026",
      }).success,
    ).toBe(false);
  });

  it("rejects an empty chore title", () => {
    const result = createChoreSchema.safeParse({
      title: "   ",
      startDate: "2026-08-20",
      recurrence: {
        frequency: "DAILY",
      },
      rotationUserIds: [],
    });

    expect(result.success).toBe(false);
  });
});
