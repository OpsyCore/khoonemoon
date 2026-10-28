import { describe, expect, it } from "vitest";
import { formatAmount, getBillStatus, summarizeFinance } from "./bills";
import type { FinancialRecord } from "./types";

const now = new Date("2026-10-28T12:00:00.000Z");

function record(overrides: Partial<FinancialRecord>): FinancialRecord {
  return {
    id: "record-1",
    household_id: "household-1",
    owner_id: "user-a",
    created_by: "user-a",
    visibility: "HOUSEHOLD_SHARED",
    record_type: "BILL",
    title: "قبض برق",
    amount: 500000,
    currency: "IRR",
    category: "خانه",
    note: null,
    occurred_at: "2026-10-01T00:00:00.000Z",
    due_at: "2026-10-20T00:00:00.000Z",
    bill_status: null,
    is_recurring: false,
    recurrence_rule: null,
    paid_by: null,
    paid_at: null,
    archived_at: null,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("getBillStatus", () => {
  it("marks past due bills as overdue", () => {
    expect(getBillStatus({ dueAt: "2026-10-20T00:00:00.000Z", now })).toBe(
      "OVERDUE",
    );
  });

  it("marks bills inside the three-day window as due", () => {
    expect(getBillStatus({ dueAt: "2026-10-29T10:00:00.000Z", now })).toBe("DUE");
  });

  it("marks later bills as upcoming", () => {
    expect(getBillStatus({ dueAt: "2026-11-20T00:00:00.000Z", now })).toBe(
      "UPCOMING",
    );
  });

  it("keeps paid bills paid", () => {
    expect(
      getBillStatus({
        dueAt: "2026-10-20T00:00:00.000Z",
        paidAt: "2026-10-19T00:00:00.000Z",
        now,
      }),
    ).toBe("PAID");
  });
});

describe("summarizeFinance", () => {
  it("separates income, expenses and outstanding bills", () => {
    const summary = summarizeFinance(
      [
        record({ id: "1", record_type: "INCOME", amount: 10_000_000 }),
        record({ id: "2", record_type: "EXPENSE", amount: 2_000_000 }),
        record({ id: "3", amount: 500_000 }),
        record({
          id: "4",
          amount: 900_000,
          due_at: "2026-10-29T00:00:00.000Z",
        }),
        record({
          id: "5",
          amount: 1_000_000,
          paid_at: "2026-10-25T00:00:00.000Z",
        }),
      ],
      now,
    );

    expect(summary.income).toBe(10_000_000);
    expect(summary.expense).toBe(2_000_000);
    expect(summary.outstanding).toBe(1_400_000);
    expect(summary.overdueCount).toBe(1);
    expect(summary.dueSoonCount).toBe(1);
  });
});

describe("formatAmount", () => {
  it("formats rials as Persian toman", () => {
    expect(formatAmount(1_250_000)).toContain("تومان");
  });
});
