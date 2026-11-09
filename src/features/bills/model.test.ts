import { describe, expect, it } from "vitest";
import type { FinancialRecord } from "@/features/finance/types";
import { billCategory, billsDashboard, shiftPersianMonth } from "./model";
import { jalaliMonthKey } from "@/features/finance/analytics";
function record(patch: Partial<FinancialRecord>): FinancialRecord {
  return {
    id: "1",
    household_id: null,
    owner_id: "u",
    created_by: "u",
    visibility: "PRIVATE",
    record_type: "BILL",
    title: "قبض آب",
    amount: 100,
    currency: "IRR",
    category: "آب",
    note: null,
    occurred_at: "2026-10-01T00:00:00Z",
    due_at: "2026-10-31T00:00:00Z",
    bill_status: "UPCOMING",
    is_recurring: false,
    recurrence_rule: null,
    paid_by: null,
    paid_at: null,
    archived_at: null,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    ...patch,
  };
}
describe("bills dashboard", () => {
  it("classifies existing category or title without inventing categories", () => {
    expect(billCategory(record({ category: null, title: "قبض برق" }))).toBe(
      "برق",
    );
    expect(billCategory(record({ category: null, title: "شهرداری" }))).toBe(
      "سایر",
    );
  });
  it("keeps pending, paid and archived separate and never mixes currencies in summaries", () => {
    const now = new Date("2026-10-20T12:00:00Z");
    const result = billsDashboard(
      [
        record({ id: "due" }),
        record({ id: "paid", paid_at: now.toISOString(), amount: 125 }),
        record({
          id: "usd",
          paid_at: now.toISOString(),
          currency: "USD",
          amount: 999,
        }),
        record({ id: "archived", archived_at: now.toISOString() }),
        record({ id: "expense", record_type: "EXPENSE" }),
      ],
      now,
    );
    expect(result.pending.map((r) => r.id)).toEqual(["due"]);
    expect(result.paid.map((r) => r.id)).toEqual(["paid", "usd"]);
    expect(result.total).toBe(125);
    expect(result.categories.find((c) => c.name === "آب")?.total).toBe(125);
    expect(result.change).toBeNull();
  });
  it("moves between Persian months including across year boundaries and compares paid amounts", () => {
    const current = new Date("2026-03-22T12:00:00Z");
    const before = shiftPersianMonth(current, -1);
    const next = shiftPersianMonth(before, 1);
    expect(jalaliMonthKey(before)).not.toBe(jalaliMonthKey(current));
    expect(jalaliMonthKey(next)).toBe(jalaliMonthKey(current));
    const result = billsDashboard(
      [
        record({ id: "a", paid_at: current.toISOString(), amount: 50 }),
        record({ id: "b", paid_at: before.toISOString(), amount: 100 }),
      ],
      current,
    );
    expect(result.change).toBe(-50);
  });
});
