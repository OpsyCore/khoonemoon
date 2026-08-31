import { describe, expect, it } from "vitest";
import { signupSchema } from "@/features/auth/schemas";
import { buildTodayBillItems } from "@/features/finance/today";
import { canAccessPrivateRecord } from "@/features/households/security";
import {
  canAccessTask,
  validateTaskAssignment,
} from "@/features/tasks/security";
import { createShoppingListSchema } from "@/features/shopping/schemas";

/**
 * FEATURES.md MVP acceptance scenarios, encoded against the real
 * domain rules used by the APIs. Live two-user browser e2e still
 * requires a configured Supabase project (see E2E.md).
 */
describe("M11 critical journeys", () => {
  it("1. two users can pass signup validation independently", () => {
    expect(
      signupSchema.safeParse({
        fullName: "کاربر الف",
        email: "user-a@example.com",
        password: "12345678",
      }).success,
    ).toBe(true);

    expect(
      signupSchema.safeParse({
        fullName: "کاربر ب",
        email: "user-b@example.com",
        password: "12345678",
      }).success,
    ).toBe(true);
  });

  it("2. a shared household is visible only to its members", () => {
    expect(
      canAccessPrivateRecord({
        viewerId: "user-b",
        ownerId: "user-a",
        visibility: "HOUSEHOLD_SHARED",
        viewerHouseholdId: "h1",
        targetHouseholdId: "h1",
      }),
    ).toBe(true);

    expect(
      canAccessPrivateRecord({
        viewerId: "user-c",
        ownerId: "user-a",
        visibility: "HOUSEHOLD_SHARED",
        viewerHouseholdId: "h2",
        targetHouseholdId: "h1",
      }),
    ).toBe(false);
  });

  it("3. partner sees a HOUSEHOLD_SHARED task", () => {
    expect(
      canAccessTask({
        viewerId: "user-b",
        viewerHouseholdIds: ["h1"],
        ownerId: "user-a",
        householdId: "h1",
        visibility: "HOUSEHOLD_SHARED",
      }),
    ).toBe(true);

    expect(
      validateTaskAssignment({
        visibility: "HOUSEHOLD_SHARED",
        ownerId: "user-a",
        assigneeIds: ["user-a", "user-b"],
        householdMemberIds: ["user-a", "user-b"],
      }),
    ).toBe(true);
  });

  it("4. partner does not see a PRIVATE task", () => {
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

  it("5. shopping lists require a household-scoped name payload", () => {
    expect(
      createShoppingListSchema.safeParse({ name: "نانوایی" }).success,
    ).toBe(true);
    expect(
      createShoppingListSchema.safeParse({
        name: "نانوایی",
        household_id: "ignored-by-schema",
      }).success,
    ).toBe(true);
  });

  it("6. Today only surfaces unpaid overdue and due-today bills", () => {
    const now = new Date(2026, 7, 28, 12, 0, 0);
    const items = buildTodayBillItems(
      [
        {
          id: "overdue",
          record_type: "BILL",
          title: "برق",
          amount: 100,
          currency: "IRR",
          due_at: new Date(2026, 7, 20, 10).toISOString(),
          paid_at: null,
        },
        {
          id: "due-today",
          record_type: "BILL",
          title: "آب",
          amount: 50,
          currency: "IRR",
          due_at: new Date(2026, 7, 28, 18).toISOString(),
          paid_at: null,
        },
        {
          id: "upcoming",
          record_type: "BILL",
          title: "گاز",
          amount: 70,
          currency: "IRR",
          due_at: new Date(2026, 8, 1, 10).toISOString(),
          paid_at: null,
        },
        {
          id: "paid",
          record_type: "BILL",
          title: "اینترنت",
          amount: 80,
          currency: "IRR",
          due_at: new Date(2026, 7, 28, 9).toISOString(),
          paid_at: new Date(2026, 7, 27, 9).toISOString(),
        },
        {
          id: "expense",
          record_type: "EXPENSE",
          title: "نان",
          amount: 10,
          currency: "IRR",
          due_at: null,
          paid_at: null,
        },
      ],
      now,
    );

    expect(items.map((item) => item.id)).toEqual(["overdue", "due-today"]);
    expect(items[0]?.overdue).toBe(true);
    expect(items[1]?.overdue).toBe(false);
  });
});
