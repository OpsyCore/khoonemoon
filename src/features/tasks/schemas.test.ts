import { describe, expect, it } from "vitest";
import { createTaskSchema, patchTaskSchema } from "@/features/tasks/schemas";

const userA = "11111111-1111-4111-8111-111111111111";
const userB = "22222222-2222-4222-8222-222222222222";

function validTask(overrides: Record<string, unknown> = {}) {
  return {
    title: "خرید نان",
    visibility: "PRIVATE",
    priority: "NORMAL",
    status: "PENDING",
    assigneeIds: [userA],
    recurrence: { frequency: "NONE" },
    ...overrides,
  };
}

describe("task schemas", () => {
  it("accepts a valid private task", () => {
    expect(createTaskSchema.safeParse(validTask()).success).toBe(true);
  });

  it("rejects a title shorter than 2 characters", () => {
    expect(createTaskSchema.safeParse(validTask({ title: "ا" })).success).toBe(
      false,
    );
  });

  it("rejects a private task assigned to more than one person", () => {
    const result = createTaskSchema.safeParse(
      validTask({ assigneeIds: [userA, userB] }),
    );
    expect(result.success).toBe(false);
  });

  it("requires intervalDays for INTERVAL_DAYS", () => {
    const result = createTaskSchema.safeParse(
      validTask({
        recurrence: { frequency: "INTERVAL_DAYS" },
      }),
    );
    expect(result.success).toBe(false);
  });

  it("requires weekdays for WEEKLY", () => {
    const result = createTaskSchema.safeParse(
      validTask({
        recurrence: { frequency: "WEEKLY", weekdays: [] },
      }),
    );
    expect(result.success).toBe(false);
  });

  it("accepts complete/undo/archive patch actions", () => {
    expect(patchTaskSchema.safeParse({ action: "complete" }).success).toBe(true);
    expect(patchTaskSchema.safeParse({ action: "undo" }).success).toBe(true);
    expect(patchTaskSchema.safeParse({ action: "archive" }).success).toBe(true);
  });

  it("requires dueAt for reschedule", () => {
    expect(patchTaskSchema.safeParse({ action: "reschedule" }).success).toBe(
      false,
    );
    expect(
      patchTaskSchema.safeParse({
        action: "reschedule",
        dueAt: "2026-08-28T10:00:00.000Z",
      }).success,
    ).toBe(true);
  });
});
