import { describe, expect, it } from "vitest";
import { getChoreState, resolveCurrentAssignee } from "./rotation";
import type { ChoreRotationStep } from "./types";

function step(position: number, assigneeId: string): ChoreRotationStep {
  return {
    id: `step-${position}`,
    chore_id: "chore-1",
    position,
    assignee_id: assigneeId,
  };
}

const steps = [step(0, "user-a"), step(1, "user-b")];

describe("resolveCurrentAssignee", () => {
  it("always returns the first person for FIXED chores", () => {
    expect(
      resolveCurrentAssignee({
        rotationMode: "FIXED",
        currentRotationIndex: 1,
        steps: [step(1, "user-b"), step(0, "user-a")],
      }),
    ).toBe("user-a");
  });

  it("follows the rotation index for ROTATING chores", () => {
    expect(
      resolveCurrentAssignee({
        rotationMode: "ROTATING",
        currentRotationIndex: 0,
        steps,
      }),
    ).toBe("user-a");

    expect(
      resolveCurrentAssignee({
        rotationMode: "ROTATING",
        currentRotationIndex: 1,
        steps,
      }),
    ).toBe("user-b");
  });

  it("wraps out-of-range indexes safely", () => {
    expect(
      resolveCurrentAssignee({
        rotationMode: "ROTATING",
        currentRotationIndex: 5,
        steps,
      }),
    ).toBe("user-b");
  });

  it("returns null when no rotation steps exist", () => {
    expect(
      resolveCurrentAssignee({
        rotationMode: "ROTATING",
        currentRotationIndex: 0,
        steps: [],
      }),
    ).toBeNull();
  });
});

describe("getChoreState", () => {
  const now = new Date("2026-10-28T12:00:00.000Z");

  it("flags past dues as overdue", () => {
    expect(
      getChoreState({
        nextDueAt: "2026-10-20T09:00:00.000Z",
        isActive: true,
        now,
      }),
    ).toBe("OVERDUE");
  });

  it("flags same-day dues as due today", () => {
    expect(
      getChoreState({
        nextDueAt: "2026-10-28T20:00:00.000Z",
        isActive: true,
        now,
      }),
    ).toBe("DUE_TODAY");
  });

  it("flags later dues as upcoming", () => {
    expect(
      getChoreState({
        nextDueAt: "2026-11-05T09:00:00.000Z",
        isActive: true,
        now,
      }),
    ).toBe("UPCOMING");
  });

  it("reports paused chores regardless of the due date", () => {
    expect(
      getChoreState({
        nextDueAt: "2026-10-20T09:00:00.000Z",
        isActive: false,
        now,
      }),
    ).toBe("PAUSED");
  });
});
