import type { FinancialRecord } from "@/features/finance/types";

/**
 * Finance analytics ("نمودار مالی").
 *
 * The finance tab could only show a flat summary (income / expense /
 * outstanding). These helpers turn the same records into a month-by-month trend
 * and a category breakdown, bucketed on the **Jalali** calendar that the rest of
 * the app displays, so a month in the chart means the same month as in the UI.
 */

export type MonthlyPoint = {
  /** Stable key, e.g. `1405-08`. */
  key: string;
  /** Month name for the axis, e.g. `مهر`. */
  label: string;
  income: number;
  expense: number;
};

export type CategorySlice = {
  category: string;
  total: number;
  /** 0–100, rounded, and guaranteed not to exceed 100. */
  share: number;
};

export type FinanceAnalytics = {
  months: MonthlyPoint[];
  categories: CategorySlice[];
  /** Highest income/expense value across the months, for axis scaling. */
  peak: number;
  hasData: boolean;
};

const PERSIAN_CALENDAR = "en-u-ca-persian";
const DAY_MS = 24 * 60 * 60 * 1000;

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * `1405-08` in the Persian calendar with ASCII digits, so keys sort and compare
 * predictably (Persian digits would break `===` against literals in tests).
 */
export function jalaliMonthKey(date: Date): string {
  const parts = new Intl.DateTimeFormat(PERSIAN_CALENDAR, {
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";

  return `${year}-${month}`;
}

/** Month name only, e.g. `مهر` — short enough for a chart axis. */
export function jalaliMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat("fa-IR", { month: "long" }).format(date);
}

/**
 * The `count` most recent month keys ending with the month of `now`, oldest
 * first. Walks day by day because Persian months have irregular lengths and
 * month arithmetic on a Gregorian `Date` would skip or repeat a bucket.
 */
export function recentMonthKeys(
  now: Date,
  count: number,
): { key: string; label: string }[] {
  if (count <= 0) return [];

  const seen = new Map<string, string>();
  let cursor = new Date(now.getTime());

  // 32 days per month is enough headroom for the longest Persian month (31).
  const limit = count * 32 + 32;

  for (let step = 0; step < limit && seen.size < count; step += 1) {
    const key = jalaliMonthKey(cursor);

    if (!seen.has(key)) seen.set(key, jalaliMonthLabel(cursor));

    cursor = new Date(cursor.getTime() - DAY_MS);
  }

  return [...seen.entries()].map(([key, label]) => ({ key, label })).reverse();
}

/**
 * The date the money actually moved: when it was paid, otherwise when it is due,
 * otherwise when it was recorded. This keeps a bill in the month it was settled
 * instead of the month it was typed in.
 */
function moneyDate(record: FinancialRecord): Date | null {
  return (
    toDate(record.paid_at) ??
    toDate(record.due_at) ??
    toDate(record.occurred_at)
  );
}

export function buildMonthlySeries({
  records,
  now,
  months = 6,
}: {
  records: FinancialRecord[];
  now: Date;
  months?: number;
}): MonthlyPoint[] {
  const buckets = recentMonthKeys(now, months).map(({ key, label }) => ({
    key,
    label,
    income: 0,
    expense: 0,
  }));

  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  for (const record of records) {
    if (record.archived_at) continue;

    const date = moneyDate(record);
    if (!date) continue;

    const bucket = byKey.get(jalaliMonthKey(date));
    if (!bucket) continue;

    const amount = Number(record.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    if (record.record_type === "INCOME") {
      bucket.income += amount;
    } else {
      bucket.expense += amount;
    }
  }

  return buckets;
}

export function buildCategoryBreakdown({
  records,
  now,
  months = 6,
}: {
  records: FinancialRecord[];
  now: Date;
  months?: number;
}): CategorySlice[] {
  const windowKeys = new Set(
    recentMonthKeys(now, months).map(({ key }) => key),
  );
  const totals = new Map<string, number>();
  let grandTotal = 0;

  for (const record of records) {
    if (record.archived_at) continue;
    if (record.record_type === "INCOME") continue;

    const date = moneyDate(record);
    if (!date) continue;
    if (!windowKeys.has(jalaliMonthKey(date))) continue;

    const amount = Number(record.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const category = record.category?.trim() || "بدون دسته";
    totals.set(category, (totals.get(category) ?? 0) + amount);
    grandTotal += amount;
  }

  return [...totals.entries()]
    .map(([category, total]) => ({
      category,
      total,
      share:
        grandTotal > 0
          ? Math.min(100, Math.round((total / grandTotal) * 100))
          : 0,
    }))
    .sort(
      (a, b) => b.total - a.total || a.category.localeCompare(b.category, "fa"),
    );
}

export function buildFinanceAnalytics({
  records,
  now,
  months = 6,
}: {
  records: FinancialRecord[];
  now: Date;
  months?: number;
}): FinanceAnalytics {
  const series = buildMonthlySeries({ records, now, months });
  const categories = buildCategoryBreakdown({ records, now, months });

  const peak = series.reduce(
    (max, point) => Math.max(max, point.income, point.expense),
    0,
  );

  return {
    months: series,
    categories,
    peak,
    hasData: series.some((point) => point.income > 0 || point.expense > 0),
  };
}
