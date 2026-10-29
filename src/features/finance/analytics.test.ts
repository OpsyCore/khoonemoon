import { describe, expect, it } from "vitest";
import {
  buildCategoryBreakdown,
  buildFinanceAnalytics,
  buildMonthlySeries,
  jalaliMonthKey,
  jalaliMonthLabel,
  recentMonthKeys,
} from "@/features/finance/analytics";
import type { FinancialRecord } from "@/features/finance/types";

const NOW = new Date("2026-10-29T12:00:00.000Z"); // 1405-08 (آبان)

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
    category: null,
    note: null,
    occurred_at: "2026-10-29T00:00:00.000Z",
    due_at: null,
    bill_status: null,
    is_recurring: false,
    recurrence_rule: null,
    paid_by: null,
    paid_at: null,
    archived_at: null,
    created_at: "2026-10-29T00:00:00.000Z",
    updated_at: "2026-10-29T00:00:00.000Z",
    ...overrides,
  };
}

describe("jalaliMonthKey / jalaliMonthLabel", () => {
  it("maps Gregorian dates to Persian month keys with ASCII digits", () => {
    expect(jalaliMonthKey(new Date("2026-10-29T12:00:00Z"))).toBe("1405-08");
    expect(jalaliMonthKey(new Date("2026-10-01T12:00:00Z"))).toBe("1405-07");
    expect(jalaliMonthKey(new Date("2026-09-15T12:00:00Z"))).toBe("1405-06");
  });

  it("returns the Persian month name", () => {
    expect(jalaliMonthLabel(new Date("2026-10-29T12:00:00Z"))).toBe("آبان");
    expect(jalaliMonthLabel(new Date("2026-10-01T12:00:00Z"))).toBe("مهر");
  });
});

describe("recentMonthKeys", () => {
  it("returns months oldest first, ending with the current month", () => {
    const keys = recentMonthKeys(NOW, 3);

    expect(keys).toEqual([
      { key: "1405-06", label: "شهریور" },
      { key: "1405-07", label: "مهر" },
      { key: "1405-08", label: "آبان" },
    ]);
  });

  it("crosses a Persian year boundary in order", () => {
    const keys = recentMonthKeys(new Date("2026-04-05T12:00:00Z"), 4).map(
      (month) => month.key,
    );

    expect(keys).toHaveLength(4);
    expect(new Set(keys).size).toBe(4);
    // Chronological order is what the chart relies on.
    expect([...keys].sort()).toEqual(keys);
    expect(keys[keys.length - 1]).toBe(
      jalaliMonthKey(new Date("2026-04-05T12:00:00Z")),
    );
  });

  it("returns nothing for a non-positive count", () => {
    expect(recentMonthKeys(NOW, 0)).toEqual([]);
    expect(recentMonthKeys(NOW, -3)).toEqual([]);
  });
});

describe("buildMonthlySeries", () => {
  it("buckets income and expenses into the right month", () => {
    const series = buildMonthlySeries({
      records: [
        record({ amount: 500_000, record_type: "INCOME" }),
        record({ amount: 120_000, record_type: "EXPENSE" }),
        record({
          amount: 300_000,
          record_type: "EXPENSE",
          occurred_at: "2026-10-02T00:00:00.000Z", // 1405-07 (مهر)
        }),
      ],
      now: NOW,
      months: 3,
    });

    expect(series.map((point) => point.key)).toEqual([
      "1405-06",
      "1405-07",
      "1405-08",
    ]);
    expect(series[0]).toMatchObject({ income: 0, expense: 0 });
    expect(series[1]).toMatchObject({ income: 0, expense: 300_000 });
    expect(series[2]).toMatchObject({ income: 500_000, expense: 120_000 });
  });

  it("places a paid bill in the month it was paid, not the month it was due", () => {
    const series = buildMonthlySeries({
      records: [
        record({
          record_type: "BILL",
          amount: 80_000,
          due_at: "2026-10-05T00:00:00.000Z", // مهر
          paid_at: "2026-10-28T00:00:00.000Z", // آبان
        }),
      ],
      now: NOW,
      months: 3,
    });

    expect(series[1].expense).toBe(0);
    expect(series[2].expense).toBe(80_000);
  });

  it("ignores archived, future-window and non-positive records", () => {
    const series = buildMonthlySeries({
      records: [
        record({ archived_at: "2026-10-20T00:00:00.000Z" }),
        record({ occurred_at: "2025-01-01T00:00:00.000Z" }),
        record({ amount: 0 }),
        record({ amount: -50_000 }),
        record({ amount: "not-a-number" as unknown as number }),
      ],
      now: NOW,
      months: 3,
    });

    expect(
      series.every((point) => point.income === 0 && point.expense === 0),
    ).toBe(true);
  });

  it("accepts numeric strings coming from Postgres", () => {
    const series = buildMonthlySeries({
      records: [record({ amount: "420000.50" })],
      now: NOW,
      months: 1,
    });

    expect(series[0].expense).toBe(420_000.5);
  });

  it("always returns exactly the requested number of buckets", () => {
    expect(
      buildMonthlySeries({ records: [], now: NOW, months: 6 }),
    ).toHaveLength(6);
    expect(
      buildMonthlySeries({ records: [], now: NOW, months: 1 }),
    ).toHaveLength(1);
  });
});

describe("buildCategoryBreakdown", () => {
  it("groups by category, sorts by total and rounds shares", () => {
    const slices = buildCategoryBreakdown({
      records: [
        record({ amount: 600_000, category: "خوراک" }),
        record({ amount: 200_000, category: "حمل‌ونقل" }),
        record({ amount: 200_000, category: null }),
        record({ amount: 999_000, record_type: "INCOME", category: "حقوق" }),
      ],
      now: NOW,
      months: 1,
    });

    // The biggest slice comes first; equal totals may tie in either order.
    expect(slices[0]).toEqual({
      category: "خوراک",
      total: 600_000,
      share: 60,
    });
    expect(slices).toHaveLength(3);
    expect(
      slices
        .map((slice) => `${slice.category}:${slice.total}:${slice.share}`)
        .sort(),
    ).toEqual(
      ["حمل‌ونقل:200000:20", "خوراک:600000:60", "بدون دسته:200000:20"].sort(),
    );
    expect(slices.reduce((sum, slice) => sum + slice.share, 0)).toBe(100);
    expect(slices.every((slice) => slice.share <= 100)).toBe(true);
  });

  it("treats blank categories as uncategorised", () => {
    const slices = buildCategoryBreakdown({
      records: [record({ category: "   " })],
      now: NOW,
    });

    expect(slices[0].category).toBe("بدون دسته");
  });

  it("keeps records outside the window out of the breakdown", () => {
    const slices = buildCategoryBreakdown({
      records: [
        record({ amount: 100_000, category: "خوراک" }),
        record({
          amount: 900_000,
          category: "خوراک",
          occurred_at: "2025-02-01T00:00:00.000Z",
        }),
      ],
      now: NOW,
      months: 2,
    });

    expect(slices).toEqual([{ category: "خوراک", total: 100_000, share: 100 }]);
  });

  it("returns an empty list when only income exists", () => {
    expect(
      buildCategoryBreakdown({
        records: [record({ record_type: "INCOME", category: "حقوق" })],
        now: NOW,
      }),
    ).toEqual([]);
  });
});

describe("buildFinanceAnalytics", () => {
  it("reports the peak value used for axis scaling", () => {
    const analytics = buildFinanceAnalytics({
      records: [
        record({ amount: 900_000, record_type: "INCOME" }),
        record({ amount: 400_000, category: "خوراک" }),
      ],
      now: NOW,
      months: 3,
    });

    expect(analytics.peak).toBe(900_000);
    expect(analytics.hasData).toBe(true);
    expect(analytics.months).toHaveLength(3);
  });

  it("flags an empty history so the UI can show an empty state", () => {
    const analytics = buildFinanceAnalytics({
      records: [],
      now: NOW,
      months: 6,
    });

    expect(analytics).toMatchObject({
      peak: 0,
      hasData: false,
      categories: [],
    });
    expect(analytics.months).toHaveLength(6);
  });
});
