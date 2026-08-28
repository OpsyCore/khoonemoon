import { describe, expect, it } from "vitest";
import type { CreateFinanceRecordInput } from "./schemas";
import {
  financeErrorCode,
  financeErrorStatus,
  mapFinanceError,
  requireFinanceUserId,
  resolveCreateFinanceHousehold,
  resolveFinancePaidBy,
  sortFinanceRecords,
  toCreateFinanceRpcArgs,
  toSetFinancePaidRpcArgs,
  toUpdateFinanceRpcArgs,
} from "./server";
import type { FinanceRecord } from "./types";

const dueAt = "2026-08-27T20:00:00.000Z";
const occurredAt = "2026-08-26T08:00:00.000Z";

const privateBill = {
  recordType: "BILL",
  title: "برق",
  amount: 120000,
  currency: "IRR",
  visibility: "PRIVATE",
  dueAt,
} satisfies CreateFinanceRecordInput;

const sharedExpense = {
  recordType: "EXPENSE",
  title: "نان",
  amount: 50,
  currency: "IRR",
  visibility: "HOUSEHOLD_SHARED",
  occurredAt,
} satisfies CreateFinanceRecordInput;

function record(
  overrides: Partial<FinanceRecord> & Pick<FinanceRecord, "id">,
): FinanceRecord {
  return {
    record_type: "BILL",
    title: "item",
    amount: 1,
    currency: "IRR",
    owner_id: "user-a",
    created_by: "user-a",
    household_id: null,
    visibility: "PRIVATE",
    due_at: null,
    occurred_at: null,
    paid_at: null,
    paid_by: null,
    category: null,
    note: null,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("toCreateFinanceRpcArgs", () => {
  it("maps PRIVATE create visibility correctly", () => {
    const args = toCreateFinanceRpcArgs(privateBill);
    expect(args.p_visibility).toBe("PRIVATE");
    expect(args.p_record_type).toBe("BILL");
    expect(args.p_due_at).toBe(dueAt);
    expect(args.p_occurred_at).toBeNull();
  });

  it("does not accept or forward household_id from the client on SHARED create", () => {
    const args = toCreateFinanceRpcArgs({
      ...sharedExpense,
      householdId: "client-household",
      household_id: "client-household",
    } as CreateFinanceRecordInput);
    expect(args.p_visibility).toBe("HOUSEHOLD_SHARED");
    expect(args).not.toHaveProperty("household_id");
    expect(args).not.toHaveProperty("p_household_id");
    expect(Object.keys(args)).not.toContain("householdId");
  });

  it("never includes owner_id", () => {
    const args = toCreateFinanceRpcArgs({
      ...privateBill,
      ownerId: "forged-owner",
    } as CreateFinanceRecordInput);
    expect(args).not.toHaveProperty("owner_id");
    expect(args).not.toHaveProperty("p_owner_id");
  });

  it("never includes created_by", () => {
    const args = toCreateFinanceRpcArgs({
      ...privateBill,
      createdBy: "forged-creator",
    } as CreateFinanceRecordInput);
    expect(args).not.toHaveProperty("created_by");
    expect(args).not.toHaveProperty("p_created_by");
  });

  it("never includes paid_at", () => {
    const args = toCreateFinanceRpcArgs({
      ...privateBill,
      paidAt: dueAt,
    } as CreateFinanceRecordInput);
    expect(args).not.toHaveProperty("paid_at");
    expect(args).not.toHaveProperty("p_paid_at");
  });

  it("never includes paid_by", () => {
    const args = toCreateFinanceRpcArgs({
      ...privateBill,
      paidBy: "user-a",
    } as CreateFinanceRecordInput);
    expect(args).not.toHaveProperty("paid_by");
    expect(args).not.toHaveProperty("p_paid_by");
  });
});

describe("toUpdateFinanceRpcArgs", () => {
  it("contains only editable fields", () => {
    const args = toUpdateFinanceRpcArgs("rec-1", {
      title: "قبض گاز",
      amount: 10,
      currency: "IRR",
      dueAt,
      occurredAt: null,
      category: null,
      note: null,
    });

    expect(args).toEqual({
      p_id: "rec-1",
      p_title: "قبض گاز",
      p_amount: 10,
      p_currency: "IRR",
      p_due_at: dueAt,
      p_occurred_at: null,
      p_category: null,
      p_note: null,
    });
  });

  it("cannot change record_type", () => {
    const args = toUpdateFinanceRpcArgs("rec-1", {
      title: "قبض گاز",
      amount: 10,
      currency: "IRR",
      dueAt,
      occurredAt: null,
      category: null,
      note: null,
      recordType: "EXPENSE",
    } as never);

    expect(args).not.toHaveProperty("record_type");
    expect(args).not.toHaveProperty("p_record_type");
  });

  it("cannot change visibility", () => {
    const args = toUpdateFinanceRpcArgs("rec-1", {
      title: "قبض گاز",
      amount: 10,
      currency: "IRR",
      dueAt,
      occurredAt: null,
      category: null,
      note: null,
      visibility: "HOUSEHOLD_SHARED",
    } as never);

    expect(args).not.toHaveProperty("visibility");
    expect(args).not.toHaveProperty("p_visibility");
  });
});

describe("toSetFinancePaidRpcArgs", () => {
  it("sets p_paid=true for pay", () => {
    expect(
      toSetFinancePaidRpcArgs({
        id: "rec-1",
        paid: true,
        paidBy: "user-a",
      }),
    ).toEqual({
      p_id: "rec-1",
      p_paid: true,
      p_paid_by: "user-a",
    });
  });

  it("sets p_paid=false and null paid_by for unpay", () => {
    expect(
      toSetFinancePaidRpcArgs({
        id: "rec-1",
        paid: false,
        paidBy: "user-a",
      }),
    ).toEqual({
      p_id: "rec-1",
      p_paid: false,
      p_paid_by: null,
    });
  });
});

describe("resolveFinancePaidBy", () => {
  it("validates client-supplied paidBy before trusted use", () => {
    expect(() =>
      resolveFinancePaidBy({
        viewerId: "user-a",
        ownerId: "user-a",
        visibility: "PRIVATE",
        householdId: null,
        paidBy: "user-b",
        memberships: [
          { userId: "user-a", householdId: "h1", leftAt: null },
          { userId: "user-b", householdId: "h1", leftAt: null },
        ],
      }),
    ).toThrow("INVALID_FINANCE_PAID_BY");

    expect(
      resolveFinancePaidBy({
        viewerId: "user-a",
        ownerId: "user-a",
        visibility: "PRIVATE",
        householdId: null,
        paidBy: "user-a",
        memberships: [],
      }),
    ).toBe("user-a");
  });
});

describe("resolveCreateFinanceHousehold", () => {
  it("throws NO_HOUSEHOLD_FOR_SHARED_FINANCE when membership is missing", () => {
    expect(() =>
      resolveCreateFinanceHousehold({
        visibility: "HOUSEHOLD_SHARED",
        activeHouseholdId: null,
      }),
    ).toThrow("NO_HOUSEHOLD_FOR_SHARED_FINANCE");
  });

  it("keeps PRIVATE household null even when the caller has a household", () => {
    expect(
      resolveCreateFinanceHousehold({
        visibility: "PRIVATE",
        activeHouseholdId: "h1",
      }),
    ).toBeNull();
  });
});

describe("requireFinanceUserId", () => {
  it("throws UNAUTHORIZED when authentication is missing", () => {
    expect(() => requireFinanceUserId(null)).toThrow("UNAUTHORIZED");
    expect(() => requireFinanceUserId(undefined)).toThrow("UNAUTHORIZED");
    expect(requireFinanceUserId("user-a")).toBe("user-a");
  });
});

describe("sortFinanceRecords", () => {
  it("orders unpaid bills, then expenses, then paid bills", () => {
    const sorted = sortFinanceRecords([
      record({
        id: "paid",
        paid_at: "2026-08-20T00:00:00.000Z",
        paid_by: "user-a",
        due_at: "2026-08-10T00:00:00.000Z",
      }),
      record({
        id: "expense-old",
        record_type: "EXPENSE",
        occurred_at: "2026-08-01T00:00:00.000Z",
      }),
      record({
        id: "expense-new",
        record_type: "EXPENSE",
        occurred_at: "2026-08-21T00:00:00.000Z",
      }),
      record({ id: "bill-late", due_at: "2026-08-20T00:00:00.000Z" }),
      record({ id: "bill-early", due_at: "2026-08-05T00:00:00.000Z" }),
    ]);

    expect(sorted.map((item) => item.id)).toEqual([
      "bill-early",
      "bill-late",
      "expense-new",
      "expense-old",
      "paid",
    ]);
  });
});

describe("mapFinanceError", () => {
  it("keeps existing RPC/domain errors identifiable", () => {
    expect(financeErrorCode(new Error("UNAUTHORIZED"))).toBe("UNAUTHORIZED");
    expect(financeErrorCode(new Error("NO_HOUSEHOLD_FOR_SHARED_FINANCE"))).toBe(
      "NO_HOUSEHOLD_FOR_SHARED_FINANCE",
    );
    expect(financeErrorCode(new Error("FINANCE_NOT_FOUND"))).toBe(
      "FINANCE_NOT_FOUND",
    );
    expect(financeErrorCode(new Error("FINANCE_ACCESS_DENIED"))).toBe(
      "FINANCE_ACCESS_DENIED",
    );
    expect(financeErrorCode(new Error("FINANCE_NOT_A_BILL"))).toBe(
      "FINANCE_NOT_A_BILL",
    );
    expect(financeErrorCode(new Error("INVALID_FINANCE_PAID_BY"))).toBe(
      "INVALID_FINANCE_PAID_BY",
    );

    expect(mapFinanceError(new Error("UNAUTHORIZED"))).not.toContain(
      "UNAUTHORIZED",
    );
    expect(financeErrorStatus(new Error("UNAUTHORIZED"))).toBe(401);
    expect(financeErrorStatus(new Error("FINANCE_NOT_FOUND"))).toBe(404);
    expect(financeErrorStatus(new Error("FINANCE_ACCESS_DENIED"))).toBe(403);
    expect(
      financeErrorStatus(new Error("NO_HOUSEHOLD_FOR_SHARED_FINANCE")),
    ).toBe(400);
    expect(financeErrorStatus(new Error("FAILED_TO_LOAD_MEMBERSHIP"))).toBe(
      500,
    );
    expect(
      financeErrorCode(new Error("INVALID_FINANCE_RECORD_TYPE")),
    ).toBe("INVALID_FINANCE_RECORD_TYPE");
    expect(
      financeErrorCode(new Error("FINANCE_RECORD_IMMUTABLE_FIELDS")),
    ).toBe("FINANCE_RECORD_IMMUTABLE_FIELDS");
  });
});
