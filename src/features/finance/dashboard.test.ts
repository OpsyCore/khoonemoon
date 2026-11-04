import { expect, it } from "vitest";
import type { FinancialRecord } from "./types";
import { financeDashboard } from "./dashboard";
function rec(partial: Partial<FinancialRecord>): FinancialRecord {
  return {
    id: "x",
    household_id: "h",
    owner_id: "u",
    created_by: "u",
    visibility: "PRIVATE",
    record_type: "EXPENSE",
    title: "test",
    amount: 100,
    currency: "IRR",
    category: null,
    note: null,
    occurred_at: "2026-10-28T12:00:00Z",
    due_at: null,
    bill_status: null,
    is_recurring: false,
    recurrence_rule: null,
    paid_by: null,
    paid_at: null,
    archived_at: null,
    created_at: "2026-10-28T12:00:00Z",
    updated_at: "2026-10-28T12:00:00Z",
    ...partial,
  };
}
it("uses separate currencies and actual movements in Jalali months, not unpaid or future bills", () => {
  const now = new Date("2026-10-29T12:00:00Z");
  const result = financeDashboard(
    [
      rec({ amount: 100, visibility: "HOUSEHOLD_SHARED" }),
      rec({ amount: 50 }),
      rec({ record_type: "BILL", amount: 70, due_at: "2026-10-29T00:00:00Z" }),
      rec({ record_type: "BILL", amount: 25, paid_at: "2026-10-28T00:00:00Z" }),
      rec({
        record_type: "EXPENSE",
        amount: 50,
        occurred_at: "2026-10-01T12:00:00Z",
      }),
      rec({ record_type: "INCOME", amount: 400 }),
      rec({ currency: "USD", amount: 99999 }),
      rec({ amount: 999, occurred_at: "2026-11-10T00:00:00Z" }),
    ],
    now,
    "IRR",
  );
  expect(result.expense).toBe(175);
  expect(result.shared).toBe(100);
  expect(result.personal).toBe(75);
  expect(result.expenseChange).toBe(250);
  expect(result.income).toBe(400);
  expect(result.incomeChange).toBeNull();
  expect(result.upcoming).toHaveLength(1);
});
