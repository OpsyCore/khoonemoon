import { describe, expect, it } from "vitest";
import { deriveBillStatus, endOfLocalDay, startOfLocalDay } from "./status";
import type { FinanceRecord } from "./types";

const now = new Date("2026-08-27T12:00:00.000");

function bill(overrides: Partial<FinanceRecord> = {}): FinanceRecord {
  return {
    id: "bill-1",
    record_type: "BILL",
    title: "قبض",
    amount: 100,
    currency: "IRR",
    owner_id: "user-a",
    created_by: "user-a",
    household_id: null,
    visibility: "PRIVATE",
    due_at: "2026-08-27T18:00:00.000",
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

describe("deriveBillStatus", () => {
  it("returns PAID when paid_at is set", () => {
    expect(
      deriveBillStatus(
        bill({
          due_at: "2026-08-01T09:00:00.000",
          paid_at: "2026-08-20T09:00:00.000Z",
        }),
        now,
      ),
    ).toBe("PAID");
  });

  it("returns OVERDUE for an unpaid bill due yesterday", () => {
    expect(
      deriveBillStatus(bill({ due_at: "2026-08-26T12:00:00.000" }), now),
    ).toBe("OVERDUE");
  });

  it("returns DUE for an unpaid bill due today", () => {
    expect(
      deriveBillStatus(bill({ due_at: "2026-08-27T18:00:00.000" }), now),
    ).toBe("DUE");
  });

  it("returns UPCOMING for an unpaid bill due tomorrow", () => {
    expect(
      deriveBillStatus(bill({ due_at: "2026-08-28T09:00:00.000" }), now),
    ).toBe("UPCOMING");
  });

  it("treats exact start of today as DUE", () => {
    expect(
      deriveBillStatus(
        bill({ due_at: startOfLocalDay(now).toISOString() }),
        now,
      ),
    ).toBe("DUE");
  });

  it("treats exact end of today as UPCOMING", () => {
    expect(
      deriveBillStatus(bill({ due_at: endOfLocalDay(now).toISOString() }), now),
    ).toBe("UPCOMING");
  });

  it("is deterministic when now is supplied", () => {
    const record = bill({ due_at: "2026-08-27T00:00:00.000" });
    expect(deriveBillStatus(record, now)).toBe("DUE");
    expect(deriveBillStatus(record, now)).toBe("DUE");
    expect(
      deriveBillStatus(record, new Date("2026-08-28T12:00:00.000")),
    ).toBe("OVERDUE");
  });

  it("does not treat an expense as a bill status target", () => {
    const expense = bill({
      record_type: "EXPENSE",
      due_at: null,
      occurred_at: "2026-08-26T12:00:00.000",
    });
    expect(deriveBillStatus(expense, now)).toBe("UPCOMING");

    const expenseWithDue = bill({
      record_type: "EXPENSE",
      due_at: "2026-08-26T12:00:00.000",
      occurred_at: "2026-08-26T12:00:00.000",
    });
    expect(deriveBillStatus(expenseWithDue, now)).toBe("UPCOMING");
  });

  it("returns UPCOMING when an unpaid bill has no due_at", () => {
    expect(deriveBillStatus(bill({ due_at: null }), now)).toBe("UPCOMING");
  });
});
