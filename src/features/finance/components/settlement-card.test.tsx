import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SettlementCard } from "@/features/finance/components/settlement-card";
import type { FinancialRecord } from "@/features/finance/types";

const MEMBERS = [
  { id: "u-ali", name: "علی" },
  { id: "u-sara", name: "سارا" },
];

function record(overrides: Partial<FinancialRecord> = {}): FinancialRecord {
  return {
    id: "r-1",
    household_id: "h-1",
    owner_id: "u-ali",
    created_by: "u-ali",
    visibility: "HOUSEHOLD_SHARED",
    record_type: "EXPENSE",
    title: "خرید هفتگی",
    amount: 100_000,
    currency: "IRR",
    category: null,
    note: null,
    occurred_at: "2026-10-01T10:00:00.000Z",
    due_at: null,
    bill_status: null,
    is_recurring: false,
    recurrence_rule: null,
    paid_by: "u-ali",
    paid_at: null,
    archived_at: null,
    created_at: "2026-10-01T10:00:00.000Z",
    updated_at: "2026-10-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("<SettlementCard />", () => {
  it("renders the suggested transfer for a shared expense", () => {
    const html = renderToStaticMarkup(
      <SettlementCard
        records={[record()]}
        members={MEMBERS}
        currentUserId="u-sara"
      />,
    );

    expect(html).toContain("تسویه‌حساب خانه");
    expect(html).toContain("سارا");
    expect(html).toContain("علی");
    expect(html).toContain("بدهکار است");
    expect(html).toContain("(شما)");
  });

  it("shows the empty state when nothing has been paid yet", () => {
    const html = renderToStaticMarkup(
      <SettlementCard
        records={[record({ due_at: "2026-12-01T00:00:00.000Z" })]}
        members={MEMBERS}
        currentUserId="u-ali"
      />,
    );

    expect(html).toContain("هنوز خرج مشترکی");
    expect(html).not.toContain("بدهکار است");
  });
});
