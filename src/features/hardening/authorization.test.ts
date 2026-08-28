import { describe, expect, it } from "vitest";
import { canAccessFinanceRecord } from "@/features/finance/security";
import {
  canAccessHouseholdRecord,
  canAccessPrivateRecord,
} from "@/features/households/security";
import { canAccessTask } from "@/features/tasks/security";

const userA = "user-a";
const userB = "user-b";
const userC = "user-c";
const householdA = "household-a";
const householdB = "household-b";

describe("household isolation matrix", () => {
  it("keeps PRIVATE records owner-only across tasks, events, and finance", () => {
    expect(
      canAccessTask({
        viewerId: userB,
        viewerHouseholdIds: [householdA],
        ownerId: userA,
        householdId: null,
        visibility: "PRIVATE",
      }),
    ).toBe(false);

    expect(
      canAccessPrivateRecord({
        viewerId: userB,
        ownerId: userA,
        visibility: "PRIVATE",
        viewerHouseholdId: householdA,
        targetHouseholdId: householdA,
      }),
    ).toBe(false);

    expect(
      canAccessFinanceRecord({
        viewerId: userB,
        ownerId: userA,
        visibility: "PRIVATE",
        householdId: null,
        memberships: [
          { userId: userA, householdId: householdA, leftAt: null },
          { userId: userB, householdId: householdA, leftAt: null },
        ],
      }),
    ).toBe(false);
  });

  it("allows HOUSEHOLD_SHARED records only inside the same household", () => {
    expect(
      canAccessTask({
        viewerId: userB,
        viewerHouseholdIds: [householdA],
        ownerId: userA,
        householdId: householdA,
        visibility: "HOUSEHOLD_SHARED",
      }),
    ).toBe(true);

    expect(
      canAccessTask({
        viewerId: userC,
        viewerHouseholdIds: [householdB],
        ownerId: userA,
        householdId: householdA,
        visibility: "HOUSEHOLD_SHARED",
      }),
    ).toBe(false);

    expect(
      canAccessFinanceRecord({
        viewerId: userB,
        ownerId: userA,
        visibility: "HOUSEHOLD_SHARED",
        householdId: householdA,
        memberships: [
          { userId: userA, householdId: householdA, leftAt: null },
          { userId: userB, householdId: householdA, leftAt: null },
        ],
      }),
    ).toBe(true);

    expect(
      canAccessFinanceRecord({
        viewerId: userC,
        ownerId: userA,
        visibility: "HOUSEHOLD_SHARED",
        householdId: householdA,
        memberships: [
          { userId: userA, householdId: householdA, leftAt: null },
          { userId: userC, householdId: householdB, leftAt: null },
        ],
      }),
    ).toBe(false);
  });

  it("does not treat paid_by as a visibility grant", () => {
    expect(
      canAccessFinanceRecord({
        viewerId: userC,
        ownerId: userA,
        visibility: "PRIVATE",
        householdId: null,
        memberships: [{ userId: userC, householdId: householdA, leftAt: null }],
        paidBy: userC,
      }),
    ).toBe(false);
  });

  it("blocks leftover members from another household's records", () => {
    expect(
      canAccessHouseholdRecord({
        viewerHouseholdId: householdB,
        targetHouseholdId: householdA,
      }),
    ).toBe(false);
  });
});
