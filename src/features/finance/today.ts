import { deriveBillStatus, toFinanceAmount } from "@/features/finance/status";
import type { FinanceRecord, TodayBillItem } from "@/features/finance/types";

export type TodayBillSource = Pick<
  FinanceRecord,
  | "id"
  | "record_type"
  | "title"
  | "amount"
  | "currency"
  | "due_at"
  | "paid_at"
> & {
  category?: string | null;
  note?: string | null;
};

export function buildTodayBillItems(
  records: readonly TodayBillSource[],
  now = new Date(),
): TodayBillItem[] {
  const items: (TodayBillItem & { _index: number })[] = [];

  records.forEach((record, index) => {
    if (record.record_type !== "BILL") return;
    if (!record.due_at) return;

    const status = deriveBillStatus(record, now);
    if (status !== "OVERDUE" && status !== "DUE") return;

    items.push({
      id: record.id,
      title: record.title,
      amount: toFinanceAmount(record.amount),
      currency: record.currency,
      dueAt: record.due_at,
      overdue: status === "OVERDUE",
      category: record.category ?? null,
      note: record.note ?? null,
      status,
      _index: index,
    });
  });

  items.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    if (a.dueAt !== b.dueAt) return a.dueAt < b.dueAt ? -1 : 1;
    return a._index - b._index;
  });

  return items.map(({ _index: _unused, ...item }) => item);
}

export function filterTodayBillsAfterPay(
  items: readonly TodayBillItem[],
  paidId: string,
  paySucceeded: boolean,
): TodayBillItem[] {
  if (!paySucceeded) return [...items];
  return items.filter((item) => item.id !== paidId);
}
