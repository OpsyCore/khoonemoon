import type { BillStatus, FinanceRecord } from "@/features/finance/types";

export function startOfLocalDay(now: Date) {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function endOfLocalDay(now: Date) {
  const date = startOfLocalDay(now);
  date.setDate(date.getDate() + 1);
  return date;
}

export function toFinanceAmount(value: number | string | null | undefined) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

type BillStatusRecord = Pick<FinanceRecord, "due_at" | "paid_at"> &
  Partial<Pick<FinanceRecord, "record_type">>;

export function deriveBillStatus(
  record: BillStatusRecord,
  now: Date = new Date(),
): BillStatus {
  if (record.paid_at) {
    return "PAID";
  }

  if (record.record_type === "EXPENSE") {
    return "UPCOMING";
  }

  if (!record.due_at) {
    return "UPCOMING";
  }

  const due = new Date(record.due_at).getTime();
  if (!Number.isFinite(due)) {
    return "UPCOMING";
  }

  const startOfToday = startOfLocalDay(now).getTime();
  const endOfToday = endOfLocalDay(now).getTime();

  if (due < startOfToday) {
    return "OVERDUE";
  }

  if (due < endOfToday) {
    return "DUE";
  }

  return "UPCOMING";
}
