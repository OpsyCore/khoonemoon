import { describe, expect, it } from "vitest";
import type { FinanceRecord } from "@/features/finance/types";
import { filterFinanceRecords, summarizeFinanceRecords } from "./finance-list";

function record(overrides: Partial<FinanceRecord> = {}): FinanceRecord {
  return {
    id: "rec-1",
    record_type: "BILL",
    title: "برق",
    amount: 100,
    currency: "IRR",
    owner_id: "user-a",
    created_by: "user-a",
    household_id: null,
    visibility: "PRIVATE",
    due_at: "2026-08-27T18:00:00.000Z",
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

const unpaidBill = record({ id: "unpaid", amount: 10 });
const paidBill = record({
  id: "paid",
  amount: 20,
  paid_at: "2026-08-20T00:00:00.000Z",
  paid_by: "user-a",
});
const expense = record({
  id: "expense",
  record_type: "EXPENSE",
  amount: 30,
  due_at: null,
  occurred_at: "2026-08-26T08:00:00.000Z",
});

describe("filterFinanceRecords", () => {
  const all = [unpaidBill, paidBill, expense];

  it("returns every record for ALL / ALL", () => {
    expect(
      filterFinanceRecords(all, "ALL", "ALL").map((item) => item.id),
    ).toEqual(["unpaid", "paid", "expense"]);
  });

  it("filters bills and expenses by type", () => {
    expect(
      filterFinanceRecords(all, "BILL", "ALL").map((item) => item.id),
    ).toEqual(["unpaid", "paid"]);
    expect(
      filterFinanceRecords(all, "EXPENSE", "ALL").map((item) => item.id),
    ).toEqual(["expense"]);
  });

  it("filters bills by paid status and hides expenses", () => {
    expect(
      filterFinanceRecords(all, "ALL", "UNPAID").map((item) => item.id),
    ).toEqual(["unpaid"]);
    expect(
      filterFinanceRecords(all, "ALL", "PAID").map((item) => item.id),
    ).toEqual(["paid"]);
  });

  it("ignores paid filter when type is EXPENSE", () => {
    expect(
      filterFinanceRecords(all, "EXPENSE", "UNPAID").map((item) => item.id),
    ).toEqual(["expense"]);
  });
});

describe("summarizeFinanceRecords", () => {
  it("splits totals by unpaid bills, paid bills, and expenses", () => {
    expect(summarizeFinanceRecords([unpaidBill, paidBill, expense])).toEqual([
      {
        currency: "IRR",
        unpaidBills: 10,
        paidBills: 20,
        expenses: 30,
      },
    ]);
  });

  it("groups mixed currencies separately", () => {
    const usdExpense = record({
      id: "usd",
      record_type: "EXPENSE",
      amount: "5.50",
      currency: "USD",
      due_at: null,
      occurred_at: "2026-08-26T08:00:00.000Z",
    });

    expect(summarizeFinanceRecords([unpaidBill, usdExpense])).toEqual([
      { currency: "IRR", unpaidBills: 10, paidBills: 0, expenses: 0 },
      { currency: "USD", unpaidBills: 0, paidBills: 0, expenses: 5.5 },
    ]);
  });
});
