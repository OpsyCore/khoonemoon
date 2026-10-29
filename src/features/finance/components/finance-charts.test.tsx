import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FinanceCharts } from "@/features/finance/components/finance-charts";
import type { FinancialRecord } from "@/features/finance/types";

const NOW = new Date("2026-10-29T12:00:00.000Z");

function record(overrides: Partial<FinancialRecord> = {}): FinancialRecord {
  return {
    id: "r-1",
    household_id: "h-1",
    owner_id: "u-1",
    created_by: "u-1",
    visibility: "HOUSEHOLD_SHARED",
    record_type: "EXPENSE",
    title: "خرید",
    amount: 100_000,
    currency: "IRR",
    category: "خوراک",
    note: null,
    occurred_at: "2026-10-28T00:00:00.000Z",
    due_at: null,
    bill_status: null,
    is_recurring: false,
    recurrence_rule: null,
    paid_by: null,
    paid_at: null,
    archived_at: null,
    created_at: "2026-10-28T00:00:00.000Z",
    updated_at: "2026-10-28T00:00:00.000Z",
    ...overrides,
  };
}

describe("<FinanceCharts />", () => {
  it("renders the empty state without data", () => {
    const html = renderToStaticMarkup(
      <FinanceCharts records={[]} now={NOW} months={6} />,
    );

    expect(html).toContain("روند مالی");
    expect(html).toContain("هنوز داده‌ای برای نمودار نیست");
    // The only SVG left is the lucide icon; the chart itself must not render.
    expect(html).not.toContain(
      'aria-label="نمودار درآمد و هزینه ماه‌های گذشته"',
    );
  });

  it("draws one bar group per month and a category share list", () => {
    const html = renderToStaticMarkup(
      <FinanceCharts
        records={[
          record({ amount: 250_000, record_type: "INCOME", category: "حقوق" }),
          record({ amount: 100_000, category: "خوراک" }),
        ]}
        now={NOW}
        months={6}
      />,
    );

    expect(html).toContain("<svg");
    // Two <rect> bars per month.
    expect(html.match(/<rect/g)?.length).toBe(12);
    expect(html).toContain("سهم دسته‌ها");
    expect(html).toContain("خوراک");
    expect(html).toContain("ماه گذشته");
    expect(html).toContain("سهم دسته‌ها");
  });

  it("labels bars with readable amounts via <title>", () => {
    const html = renderToStaticMarkup(
      <FinanceCharts
        records={[record({ amount: 100_000 })]}
        now={NOW}
        months={1}
      />,
    );

    expect(html).toContain("هزینه");
    expect(html).toContain("تومان");
    expect(html).toContain("آبان");
  });
});
