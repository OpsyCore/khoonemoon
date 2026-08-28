import { describe, expect, it } from "vitest";
import {
  applyTaskCompletion,
  canAccessTask,
  normalizeRecurrence,
  normalizeTaskPriority,
  validateTaskAssignment,
} from "@/features/tasks/security";

describe("task access and assignment security", () => {
  it("allows owner to access private task and denies partner", () => {
    expect(
      canAccessTask({
        viewerId: "user-a",
        viewerHouseholdIds: ["h1"],
        ownerId: "user-a",
        householdId: null,
        visibility: "PRIVATE",
      }),
    ).toBe(true);

    expect(
      canAccessTask({
        viewerId: "user-b",
        viewerHouseholdIds: ["h1"],
        ownerId: "user-a",
        householdId: null,
        visibility: "PRIVATE",
      }),
    ).toBe(false);
  });

  it("allows household members to access a shared task", () => {
    expect(
      canAccessTask({
        viewerId: "user-b",
        viewerHouseholdIds: ["h1"],
        ownerId: "user-a",
        householdId: "h1",
        visibility: "HOUSEHOLD_SHARED",
      }),
    ).toBe(true);
  });

  it("denies shared task access for another household", () => {
    expect(
      canAccessTask({
        viewerId: "user-c",
        viewerHouseholdIds: ["h2"],
        ownerId: "user-a",
        householdId: "h1",
        visibility: "HOUSEHOLD_SHARED",
      }),
    ).toBe(false);
  });

  it("denies shared tasks that have no household id", () => {
    expect(
      canAccessTask({
        viewerId: "user-a",
        viewerHouseholdIds: ["h1"],
        ownerId: "user-a",
        householdId: null,
        visibility: "HOUSEHOLD_SHARED",
      }),
    ).toBe(false);
  });

  it("validates task assignment based on visibility", () => {
    expect(
      validateTaskAssignment({
        visibility: "PRIVATE",
        ownerId: "user-a",
        assigneeIds: ["user-a"],
        householdMemberIds: ["user-a", "user-b"],
      }),
    ).toBe(true);

    expect(
      validateTaskAssignment({
        visibility: "PRIVATE",
        ownerId: "user-a",
        assigneeIds: [],
        householdMemberIds: ["user-a", "user-b"],
      }),
    ).toBe(true);

    expect(
      validateTaskAssignment({
        visibility: "PRIVATE",
        ownerId: "user-a",
        assigneeIds: ["user-b"],
        householdMemberIds: ["user-a", "user-b"],
      }),
    ).toBe(false);

    expect(
      validateTaskAssignment({
        visibility: "HOUSEHOLD_SHARED",
        ownerId: "user-a",
        assigneeIds: ["user-a", "user-b"],
        householdMemberIds: ["user-a", "user-b"],
      }),
    ).toBe(true);

    expect(
      validateTaskAssignment({
        visibility: "HOUSEHOLD_SHARED",
        ownerId: "user-a",
        assigneeIds: ["user-c"],
        householdMemberIds: ["user-a", "user-b"],
      }),
    ).toBe(false);
  });

  it("handles completion and undo", () => {
    const completed = applyTaskCompletion({
      currentStatus: "PENDING",
      action: "complete",
    });

    expect(completed.status).toBe("COMPLETED");
    expect(completed.completedAt).toBeTruthy();

    const undone = applyTaskCompletion({
      currentStatus: "COMPLETED",
      action: "undo",
    });

    expect(undone.status).toBe("PENDING");
    expect(undone.completedAt).toBeNull();

    const undoOpen = applyTaskCompletion({
      currentStatus: "IN_PROGRESS",
      action: "undo",
    });
    expect(undoOpen.status).toBe("IN_PROGRESS");
    expect(undoOpen.completedAt).toBeNull();
  });

  it("normalizes missing priority and recurrence", () => {
    expect(normalizeTaskPriority(undefined)).toBe("NORMAL");
    expect(normalizeTaskPriority("HIGH")).toBe("HIGH");
    expect(normalizeRecurrence(undefined)).toEqual({ frequency: "NONE" });
    expect(normalizeRecurrence({ frequency: "DAILY" })).toEqual({
      frequency: "DAILY",
    });
  });
});
