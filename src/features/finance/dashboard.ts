import { jalaliMonthKey, recentMonthKeys } from "./analytics";
import { isBillRecord } from "./bills";
import type { FinancialRecord } from "./types";

/** Month totals are actual movements, not forecasts or an account balance. */
export function financeDashboard(
  records: FinancialRecord[],
  now: Date,
  currency: string,
) {
  const keys = recentMonthKeys(now, 2).map((item) => item.key);
  const [previous, current] = keys;
  let income = 0,
    expense = 0,
    previousIncome = 0,
    previousExpense = 0,
    shared = 0,
    personal = 0;
  const usable = records.filter(
    (r) => !r.archived_at && r.currency === currency,
  );
  for (const record of usable) {
    const amount = Number(record.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const incomeRecord = record.record_type === "INCOME";
    const expenseRecord =
      record.record_type === "EXPENSE" || isBillRecord(record);
    if (!incomeRecord && !expenseRecord) continue;
    if (
      !incomeRecord &&
      (isBillRecord(record) || record.due_at) &&
      !record.paid_at
    )
      continue;
    const date = new Date(record.paid_at ?? record.occurred_at);
    if (Number.isNaN(date.getTime()) || date > now) continue;
    const month = jalaliMonthKey(date);
    if (month === current) {
      if (incomeRecord) income += amount;
      else {
        expense += amount;
        if (record.visibility === "HOUSEHOLD_SHARED") shared += amount;
        else personal += amount;
      }
    } else if (month === previous) {
      if (incomeRecord) previousIncome += amount;
      else previousExpense += amount;
    }
  }
  const percent = (value: number, before: number) =>
    before > 0 ? ((value - before) / before) * 100 : null;
  const upcoming = usable
    .filter(
      (r) =>
        (isBillRecord(r) || r.record_type === "EXPENSE") &&
        !r.paid_at &&
        r.due_at,
    )
    .sort((a, b) => (a.due_at ?? "").localeCompare(b.due_at ?? ""))
    .slice(0, 3);
  const recent = usable
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 3);
  return {
    income,
    expense,
    shared,
    personal,
    incomeChange: percent(income, previousIncome),
    expenseChange: percent(expense, previousExpense),
    upcoming,
    recent,
  };
}
