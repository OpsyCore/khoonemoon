import { describe, expect, it } from "vitest";
import { FINANCE_VISIBILITIES } from "./types";
import {
  canAccessFinanceRecord,
  isFinanceVisibility,
  isValidFinanceVisibilityPairing,
  validateFinancePaidBy,
  type FinanceMembership,
} from "./security";

const householdA = "h1";
const householdB = "h2";

function membership(
  userId: string,
  householdId: string,
  leftAt: string | null = null,
): FinanceMembership {
  return { userId, householdId, leftAt };
}

const activeHouseholdA: FinanceMembership[] = [
  membership("user-a", householdA),
  membership("user-b", householdA),
];

describe("private finance access", () => {
  it("allows the owner to access a private record", () => {
    expect(
      canAccessFinanceRecord({
        viewerId: "user-a",
        ownerId: "user-a",
        visibility: "PRIVATE",
        householdId: null,
        memberships: activeHouseholdA,
      }),
    ).toBe(true);
  });

  it("denies a household partner access to a private record", () => {
    expect(
      canAccessFinanceRecord({
        viewerId: "user-b",
        ownerId: "user-a",
        visibility: "PRIVATE",
        householdId: null,
        memberships: activeHouseholdA,
      }),
    ).toBe(false);
  });

  it("denies an unrelated user access to a private record", () => {
    expect(
      canAccessFinanceRecord({
        viewerId: "user-c",
        ownerId: "user-a",
        visibility: "PRIVATE",
        householdId: null,
        memberships: [membership("user-c", householdB)],
      }),
    ).toBe(false);
  });
});

describe("shared finance access", () => {
  it("allows an active member of the same household to access a shared record", () => {
    expect(
      canAccessFinanceRecord({
        viewerId: "user-b",
        ownerId: "user-a",
        visibility: "HOUSEHOLD_SHARED",
        householdId: householdA,
        memberships: activeHouseholdA,
      }),
    ).toBe(true);
  });

  it("denies a member of another household access to a shared record", () => {
    expect(
      canAccessFinanceRecord({
        viewerId: "user-c",
        ownerId: "user-a",
        visibility: "HOUSEHOLD_SHARED",
        householdId: householdA,
        memberships: [membership("user-c", householdB)],
      }),
    ).toBe(false);
  });

  it("denies an inactive/left member access to a shared record", () => {
    expect(
      canAccessFinanceRecord({
        viewerId: "user-b",
        ownerId: "user-a",
        visibility: "HOUSEHOLD_SHARED",
        householdId: householdA,
        memberships: [
          membership("user-a", householdA),
          membership("user-b", householdA, "2026-08-01T00:00:00.000Z"),
        ],
      }),
    ).toBe(false);
  });
});

describe("visibility / household pairing", () => {
  it("accepts PRIVATE with household_id null", () => {
    expect(
      isValidFinanceVisibilityPairing({
        visibility: "PRIVATE",
        householdId: null,
      }),
    ).toBe(true);
  });

  it("rejects PRIVATE with household_id present", () => {
    expect(
      isValidFinanceVisibilityPairing({
        visibility: "PRIVATE",
        householdId: householdA,
      }),
    ).toBe(false);
    expect(
      canAccessFinanceRecord({
        viewerId: "user-a",
        ownerId: "user-a",
        visibility: "PRIVATE",
        householdId: householdA,
        memberships: activeHouseholdA,
      }),
    ).toBe(false);
  });

  it("accepts HOUSEHOLD_SHARED with household_id present", () => {
    expect(
      isValidFinanceVisibilityPairing({
        visibility: "HOUSEHOLD_SHARED",
        householdId: householdA,
      }),
    ).toBe(true);
  });

  it("rejects HOUSEHOLD_SHARED with household_id null", () => {
    expect(
      isValidFinanceVisibilityPairing({
        visibility: "HOUSEHOLD_SHARED",
        householdId: null,
      }),
    ).toBe(false);
    expect(
      canAccessFinanceRecord({
        viewerId: "user-a",
        ownerId: "user-a",
        visibility: "HOUSEHOLD_SHARED",
        householdId: null,
        memberships: activeHouseholdA,
      }),
    ).toBe(false);
  });
});

describe("paid_by validation", () => {
  it("allows PRIVATE paid_by null", () => {
    expect(
      validateFinancePaidBy({
        visibility: "PRIVATE",
        ownerId: "user-a",
        householdId: null,
        paidBy: null,
        memberships: activeHouseholdA,
      }),
    ).toBe(true);
  });

  it("allows PRIVATE paid_by owner", () => {
    expect(
      validateFinancePaidBy({
        visibility: "PRIVATE",
        ownerId: "user-a",
        householdId: null,
        paidBy: "user-a",
        memberships: activeHouseholdA,
      }),
    ).toBe(true);
  });

  it("rejects PRIVATE paid_by another user", () => {
    expect(
      validateFinancePaidBy({
        visibility: "PRIVATE",
        ownerId: "user-a",
        householdId: null,
        paidBy: "user-b",
        memberships: activeHouseholdA,
      }),
    ).toBe(false);
  });

  it("allows SHARED paid_by null", () => {
    expect(
      validateFinancePaidBy({
        visibility: "HOUSEHOLD_SHARED",
        ownerId: "user-a",
        householdId: householdA,
        paidBy: null,
        memberships: activeHouseholdA,
      }),
    ).toBe(true);
  });

  it("allows SHARED paid_by an active household member", () => {
    expect(
      validateFinancePaidBy({
        visibility: "HOUSEHOLD_SHARED",
        ownerId: "user-a",
        householdId: householdA,
        paidBy: "user-b",
        memberships: activeHouseholdA,
      }),
    ).toBe(true);
  });

  it("rejects SHARED paid_by an inactive member", () => {
    expect(
      validateFinancePaidBy({
        visibility: "HOUSEHOLD_SHARED",
        ownerId: "user-a",
        householdId: householdA,
        paidBy: "user-b",
        memberships: [
          membership("user-a", householdA),
          membership("user-b", householdA, "2026-08-01T00:00:00.000Z"),
        ],
      }),
    ).toBe(false);
  });

  it("rejects SHARED paid_by a user from another household", () => {
    expect(
      validateFinancePaidBy({
        visibility: "HOUSEHOLD_SHARED",
        ownerId: "user-a",
        householdId: householdA,
        paidBy: "user-c",
        memberships: [...activeHouseholdA, membership("user-c", householdB)],
      }),
    ).toBe(false);
  });
});

describe("finance access edge cases", () => {
  it("does not grant shared access to an owner missing from memberships", () => {
    expect(
      canAccessFinanceRecord({
        viewerId: "user-a",
        ownerId: "user-a",
        visibility: "HOUSEHOLD_SHARED",
        householdId: householdA,
        memberships: [membership("user-b", householdA)],
      }),
    ).toBe(false);
  });

  it("does not change the result when memberships are duplicated", () => {
    const duplicated = [...activeHouseholdA, ...activeHouseholdA];

    expect(
      canAccessFinanceRecord({
        viewerId: "user-b",
        ownerId: "user-a",
        visibility: "HOUSEHOLD_SHARED",
        householdId: householdA,
        memberships: duplicated,
      }),
    ).toBe(true);

    expect(
      validateFinancePaidBy({
        visibility: "HOUSEHOLD_SHARED",
        ownerId: "user-a",
        householdId: householdA,
        paidBy: "user-b",
        memberships: duplicated,
      }),
    ).toBe(true);
  });

  it("does not mutate input memberships", () => {
    const memberships = [
      membership("user-a", householdA),
      membership("user-b", householdA),
    ];
    const snapshot = memberships.map((row) => ({ ...row }));
    Object.freeze(memberships);
    Object.freeze(memberships[0]);
    Object.freeze(memberships[1]);

    canAccessFinanceRecord({
      viewerId: "user-b",
      ownerId: "user-a",
      visibility: "HOUSEHOLD_SHARED",
      householdId: householdA,
      memberships,
      paidBy: "user-b",
    });
    validateFinancePaidBy({
      visibility: "HOUSEHOLD_SHARED",
      ownerId: "user-a",
      householdId: householdA,
      paidBy: "user-b",
      memberships,
    });

    expect(memberships).toEqual(snapshot);
  });

  it("does not treat paid_by as visibility", () => {
    expect(
      canAccessFinanceRecord({
        viewerId: "user-b",
        ownerId: "user-a",
        visibility: "PRIVATE",
        householdId: null,
        memberships: activeHouseholdA,
        paidBy: "user-b",
      }),
    ).toBe(false);
  });

  it("does not include ASSIGNED visibility", () => {
    expect(FINANCE_VISIBILITIES).toEqual(["PRIVATE", "HOUSEHOLD_SHARED"]);
    expect(isFinanceVisibility("ASSIGNED")).toBe(false);
    expect(isFinanceVisibility("PRIVATE")).toBe(true);
    expect(isFinanceVisibility("HOUSEHOLD_SHARED")).toBe(true);
  });
});
