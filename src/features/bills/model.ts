import { jalaliMonthKey } from "@/features/finance/analytics";
import { isBillRecord } from "@/features/finance/bills";
import type { FinancialRecord } from "@/features/finance/types";

export const billCategories = ["برق", "آب", "گاز", "اینترنت", "تلفن"] as const;
export type BillCategory = (typeof billCategories)[number] | "سایر";
export function billCategory(
  record: Pick<FinancialRecord, "category" | "title">,
): BillCategory {
  const text = `${record.category ?? ""} ${record.title}`;
  return billCategories.find((category) => text.includes(category)) ?? "سایر";
}
export function shiftPersianMonth(date: Date, direction: -1 | 1): Date {
  const current = jalaliMonthKey(date);
  const cursor = new Date(date);
  for (let i = 0; i < 35; i++) {
    cursor.setDate(cursor.getDate() + direction);
    if (jalaliMonthKey(cursor) !== current) return cursor;
  }
  return cursor;
}
export function billsDashboard(records: FinancialRecord[], month: Date) {
  const bills = records.filter((r) => !r.archived_at && isBillRecord(r));
  const pending = bills
    .filter((r) => !r.paid_at)
    .sort((a, b) => (a.due_at ?? "9999").localeCompare(b.due_at ?? "9999"));
  const paid = bills
    .filter((r) => r.paid_at)
    .sort((a, b) => (b.paid_at ?? "").localeCompare(a.paid_at ?? ""));
  const monthTotal = (date: Date) => {
    const key = jalaliMonthKey(date);
    return paid.filter(
      (r) =>
        r.currency === "IRR" &&
        r.paid_at &&
        !Number.isNaN(new Date(r.paid_at).getTime()) &&
        jalaliMonthKey(new Date(r.paid_at)) === key,
    );
  };
  const monthRecords = monthTotal(month);
  const sum = (items: FinancialRecord[]) =>
    items.reduce(
      (total, r) =>
        total +
        (Number.isFinite(Number(r.amount)) ? Math.max(0, Number(r.amount)) : 0),
      0,
    );
  const total = sum(monthRecords);
  const previous = sum(monthTotal(shiftPersianMonth(month, -1)));
  const categories = [...billCategories, "سایر" as const].map((name) => ({
    name,
    total: sum(monthRecords.filter((r) => billCategory(r) === name)),
  }));
  return {
    pending,
    paid,
    total,
    previous,
    change: previous > 0 ? ((total - previous) / previous) * 100 : null,
    categories,
  };
}
