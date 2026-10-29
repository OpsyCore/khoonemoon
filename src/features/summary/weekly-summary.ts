import { activityDate } from "@/features/finance/ledger";
import type { FinancialRecord } from "@/features/finance/types";

/**
 * «این هفته» — a recap of the last seven days on the Today screen.
 *
 * The app could tell you what is due *today*, but not whether the household was
 * actually keeping up: did we get more done than last week, are we spending more
 * than last week? A number without a baseline is decoration, so every figure
 * here is paired with the seven days before it.
 *
 * The rules that matter, all of which are easy to get wrong:
 * - The window is half-open `[from, to)`, so a task completed exactly at the
 *   boundary is counted in exactly one week, never in both.
 * - Money uses `activityDate` (paid, else recorded) — the same rule as the
 *   ledger. Using `due_at` here would count next month's bill as this week's
 *   spending.
 * - Change is `null`, not 0% or 100%, when last week had no baseline: dividing
 *   by zero and calling the result "growth" is a lie.
 */

export const DAY_MS = 86_400_000;

export type Period = { from: Date; to: Date };
export type WeeklyWindows = { current: Period; previous: Period };

export function buildWeeklyWindows(now: Date, days = 7): WeeklyWindows {
  const edge = now.getTime();
  const currentFrom = edge - days * DAY_MS;

  return {
    current: { from: new Date(currentFrom), to: new Date(edge) },
    previous: {
      from: new Date(currentFrom - days * DAY_MS),
      to: new Date(currentFrom),
    },
  };
}

export function isWithin(date: Date | null, period: Period): boolean {
  if (!date) return false;

  const time = date.getTime();
  if (Number.isNaN(time)) return false;

  return time >= period.from.getTime() && time < period.to.getTime();
}

function parseTimestamp(raw: string | null | undefined): Date | null {
  if (!raw) return null;

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export type WeeklySummary = {
  tasksDone: number;
  tasksDonePrevious: number;
  choresDone: number;
  choresDonePrevious: number;
  spent: number;
  spentPrevious: number;
  earned: number;
  /** Percent change in spending against last week, or `null` without a baseline. */
  spentChange: number | null;
};

export type SummaryInput = {
  tasks: { completed_at: string | null }[];
  chores: { completed_at: string }[];
  finance: Pick<
    FinancialRecord,
    "record_type" | "amount" | "paid_at" | "occurred_at"
  >[];
  now: Date;
};

function sumMoney(
  records: SummaryInput["finance"],
  period: Period,
): { spent: number; earned: number } {
  return records.reduce(
    (totals, record) => {
      if (!isWithin(activityDate(record), period)) return totals;

      const amount = Number(record.amount);
      const value = Number.isFinite(amount) ? amount : 0;

      if (record.record_type === "INCOME") totals.earned += value;
      else totals.spent += value;

      return totals;
    },
    { spent: 0, earned: 0 },
  );
}

function countDone(
  rows: { completed_at: string | null }[],
  period: Period,
): number {
  return rows.filter((row) =>
    isWithin(parseTimestamp(row.completed_at), period),
  ).length;
}

/** `null` when there is no baseline — an increase from nothing has no percentage. */
export function changePercent(
  current: number,
  previous: number,
): number | null {
  if (previous <= 0) return null;

  return Math.round(((current - previous) / previous) * 100);
}

export function buildWeeklySummary({
  tasks,
  chores,
  finance,
  now,
}: SummaryInput): WeeklySummary {
  const { current, previous } = buildWeeklyWindows(now);

  const currentMoney = sumMoney(finance, current);
  const previousMoney = sumMoney(finance, previous);

  return {
    tasksDone: countDone(tasks, current),
    tasksDonePrevious: countDone(tasks, previous),
    choresDone: countDone(chores, current),
    choresDonePrevious: countDone(chores, previous),
    spent: currentMoney.spent,
    spentPrevious: previousMoney.spent,
    earned: currentMoney.earned,
    spentChange: changePercent(currentMoney.spent, previousMoney.spent),
  };
}
