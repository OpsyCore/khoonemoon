import { describe, expect, it } from "vitest";
import type { FinanceRecord } from "@/features/finance/types";
import { billStatusLabel, billStatusOf } from "./finance-display";

const now = new Date("2026-08-27T12:00:00.000");

function bill(overrides: Partial<FinanceRecord> = {}): FinanceRecord {
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

describe("finance status rendering", () => {
  it("renders PAID / OVERDUE / DUE / UPCOMING labels", () => {
    expect(billStatusLabel("PAID")).toBe("پرداخت شده");
    expect(billStatusLabel("OVERDUE")).toBe("معوق");
    expect(billStatusLabel("DUE")).toBe("امروز");
    expect(billStatusLabel("UPCOMING")).toBe("پیش‌رو");
  });

  it("derives bill status and ignores expenses", () => {
    expect(
      billStatusOf(bill({ paid_at: "2026-08-20T00:00:00.000Z" }), now),
    ).toBe("PAID");
    expect(billStatusOf(bill({ due_at: "2026-08-26T12:00:00.000" }), now)).toBe(
      "OVERDUE",
    );
    expect(billStatusOf(bill({ due_at: "2026-08-27T18:00:00.000" }), now)).toBe(
      "DUE",
    );
    expect(billStatusOf(bill({ due_at: "2026-08-28T09:00:00.000" }), now)).toBe(
      "UPCOMING",
    );
    expect(
      billStatusOf(
        bill({
          record_type: "EXPENSE",
          due_at: null,
          occurred_at: "2026-08-27T09:00:00.000",
        }),
        now,
      ),
    ).toBeNull();
  });
});
