import { describe, expect, it } from "vitest";
import {
  createFinanceRecordSchema,
  patchFinanceRecordSchema,
  updateFinanceRecordSchema,
} from "./schemas";

const dueAt = "2026-08-27T20:00:00.000Z";
const occurredAt = "2026-08-26T08:00:00.000Z";
const validPaidBy = "11111111-1111-4111-8111-111111111111";

const validBill = {
  recordType: "BILL" as const,
  title: "برق",
  amount: 120000,
  visibility: "HOUSEHOLD_SHARED" as const,
  dueAt,
};

const validExpense = {
  recordType: "EXPENSE" as const,
  title: "نان",
  amount: 50,
  visibility: "PRIVATE" as const,
  occurredAt,
};

describe("createFinanceRecordSchema", () => {
  it("accepts a valid BILL", () => {
    const result = createFinanceRecordSchema.safeParse(validBill);
    expect(result.success).toBe(true);
  });

  it("accepts a valid EXPENSE", () => {
    const result = createFinanceRecordSchema.safeParse(validExpense);
    expect(result.success).toBe(true);
  });

  it("rejects a BILL without dueAt", () => {
    const { dueAt: _dueAt, ...payload } = validBill;
    expect(createFinanceRecordSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects a BILL with occurredAt", () => {
    expect(
      createFinanceRecordSchema.safeParse({
        ...validBill,
        occurredAt,
      }).success,
    ).toBe(false);
  });

  it("rejects an EXPENSE without occurredAt", () => {
    const { occurredAt: _occurredAt, ...payload } = validExpense;
    expect(createFinanceRecordSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects an EXPENSE with dueAt", () => {
    expect(
      createFinanceRecordSchema.safeParse({
        ...validExpense,
        dueAt,
      }).success,
    ).toBe(false);
  });

  it("rejects amount = 0", () => {
    expect(
      createFinanceRecordSchema.safeParse({ ...validExpense, amount: 0 })
        .success,
    ).toBe(false);
  });

  it("rejects a negative amount", () => {
    expect(
      createFinanceRecordSchema.safeParse({ ...validExpense, amount: -5 })
        .success,
    ).toBe(false);
  });

  it("rejects a whitespace-only title", () => {
    expect(
      createFinanceRecordSchema.safeParse({ ...validExpense, title: "   " })
        .success,
    ).toBe(false);
  });

  it("trims the title", () => {
    const result = createFinanceRecordSchema.safeParse({
      ...validBill,
      title: "  برق  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("برق");
    }
  });

  it("rejects a title longer than 180 characters", () => {
    expect(
      createFinanceRecordSchema.safeParse({
        ...validExpense,
        title: "آ".repeat(181),
      }).success,
    ).toBe(false);
  });

  it("defaults omitted currency to IRR", () => {
    const result = createFinanceRecordSchema.safeParse(validBill);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe("IRR");
    }
  });

  it("rejects currency shorter than 3 characters", () => {
    expect(
      createFinanceRecordSchema.safeParse({ ...validBill, currency: "IR" })
        .success,
    ).toBe(false);
  });

  it("rejects currency longer than 8 characters", () => {
    expect(
      createFinanceRecordSchema.safeParse({
        ...validBill,
        currency: "ABCDEFGHI",
      }).success,
    ).toBe(false);
  });

  it("rejects an empty category", () => {
    expect(
      createFinanceRecordSchema.safeParse({ ...validBill, category: "   " })
        .success,
    ).toBe(false);
  });

  it("rejects a category longer than 80 characters", () => {
    expect(
      createFinanceRecordSchema.safeParse({
        ...validBill,
        category: "آ".repeat(81),
      }).success,
    ).toBe(false);
  });

  it("rejects a note longer than 1000 characters", () => {
    expect(
      createFinanceRecordSchema.safeParse({
        ...validBill,
        note: "آ".repeat(1001),
      }).success,
    ).toBe(false);
  });

  it("rejects invalid visibility", () => {
    expect(
      createFinanceRecordSchema.safeParse({
        ...validBill,
        visibility: "ASSIGNED",
      }).success,
    ).toBe(false);
  });

  it("rejects invalid recordType", () => {
    expect(
      createFinanceRecordSchema.safeParse({
        ...validBill,
        recordType: "TRANSFER",
      }).success,
    ).toBe(false);
  });

  it("rejects INCOME and SAVING record types", () => {
    expect(
      createFinanceRecordSchema.safeParse({
        ...validBill,
        recordType: "INCOME",
      }).success,
    ).toBe(false);
    expect(
      createFinanceRecordSchema.safeParse({
        ...validExpense,
        recordType: "SAVING",
      }).success,
    ).toBe(false);
  });

  it("rejects paidAt on create", () => {
    expect(
      createFinanceRecordSchema.safeParse({
        ...validBill,
        paidAt: dueAt,
      }).success,
    ).toBe(false);
  });

  it("rejects paidBy on create", () => {
    expect(
      createFinanceRecordSchema.safeParse({
        ...validBill,
        paidBy: validPaidBy,
      }).success,
    ).toBe(false);
  });

  it("rejects ownerId on create", () => {
    expect(
      createFinanceRecordSchema.safeParse({
        ...validBill,
        ownerId: validPaidBy,
      }).success,
    ).toBe(false);
  });

  it("rejects householdId on create", () => {
    expect(
      createFinanceRecordSchema.safeParse({
        ...validBill,
        householdId: validPaidBy,
      }).success,
    ).toBe(false);
  });

  it("accepts HOUSEHOLD_SHARED without householdId", () => {
    const result = createFinanceRecordSchema.safeParse(validBill);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.visibility).toBe("HOUSEHOLD_SHARED");
      expect(
        "householdId" in result.data || "household_id" in result.data,
      ).toBe(false);
    }
  });
});

describe("updateFinanceRecordSchema", () => {
  it("accepts a valid BILL update", () => {
    expect(
      updateFinanceRecordSchema.safeParse({
        title: "قبض گاز",
        dueAt,
      }).success,
    ).toBe(true);
  });

  it("accepts a valid EXPENSE update", () => {
    expect(
      updateFinanceRecordSchema.safeParse({
        title: "نان",
        occurredAt,
      }).success,
    ).toBe(true);
  });

  it("rejects a BILL update that includes occurredAt", () => {
    expect(
      updateFinanceRecordSchema.safeParse({
        title: "قبض گاز",
        dueAt,
        occurredAt,
      }).success,
    ).toBe(false);
  });

  it("rejects an EXPENSE update that includes dueAt", () => {
    expect(
      updateFinanceRecordSchema.safeParse({
        title: "نان",
        occurredAt,
        dueAt,
      }).success,
    ).toBe(false);
  });

  it("rejects an update containing recordType", () => {
    expect(
      updateFinanceRecordSchema.safeParse({
        title: "قبض گاز",
        recordType: "BILL",
      }).success,
    ).toBe(false);
  });

  it("rejects an update containing visibility", () => {
    expect(
      updateFinanceRecordSchema.safeParse({
        title: "قبض گاز",
        visibility: "PRIVATE",
      }).success,
    ).toBe(false);
  });

  it("rejects an update containing paidAt", () => {
    expect(
      updateFinanceRecordSchema.safeParse({
        title: "قبض گاز",
        paidAt: dueAt,
      }).success,
    ).toBe(false);
  });

  it("rejects an update containing paidBy", () => {
    expect(
      updateFinanceRecordSchema.safeParse({
        title: "قبض گاز",
        paidBy: validPaidBy,
      }).success,
    ).toBe(false);
  });
});

describe("patchFinanceRecordSchema", () => {
  it("accepts a valid update action", () => {
    expect(
      patchFinanceRecordSchema.safeParse({
        action: "update",
        data: { title: "قبض گاز" },
      }).success,
    ).toBe(true);
  });

  it("accepts a valid pay action", () => {
    expect(patchFinanceRecordSchema.safeParse({ action: "pay" }).success).toBe(
      true,
    );
  });

  it("accepts a valid unpay action", () => {
    expect(
      patchFinanceRecordSchema.safeParse({ action: "unpay" }).success,
    ).toBe(true);
  });

  it("rejects an invalid action", () => {
    expect(
      patchFinanceRecordSchema.safeParse({ action: "delete" }).success,
    ).toBe(false);
    expect(
      patchFinanceRecordSchema.safeParse({ action: "complete" }).success,
    ).toBe(false);
    expect(
      patchFinanceRecordSchema.safeParse({ action: "mark_paid" }).success,
    ).toBe(false);
  });

  it("accepts pay with a valid UUID", () => {
    expect(
      patchFinanceRecordSchema.safeParse({
        action: "pay",
        paidBy: validPaidBy,
      }).success,
    ).toBe(true);
  });

  it("rejects pay with an invalid UUID", () => {
    expect(
      patchFinanceRecordSchema.safeParse({
        action: "pay",
        paidBy: "not-a-uuid",
      }).success,
    ).toBe(false);
  });

  it("accepts pay with omitted paidBy", () => {
    expect(patchFinanceRecordSchema.safeParse({ action: "pay" }).success).toBe(
      true,
    );
  });

  it("rejects unpay with extra paidBy", () => {
    expect(
      patchFinanceRecordSchema.safeParse({
        action: "unpay",
        paidBy: validPaidBy,
      }).success,
    ).toBe(false);
  });
});
