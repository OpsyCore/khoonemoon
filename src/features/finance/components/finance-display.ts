import { deriveBillStatus, toFinanceAmount } from "@/features/finance/status";
import type { BillStatus, FinanceRecord } from "@/features/finance/types";
import { toPersianNumber } from "@/shared/utils/locale";

export function toDateTimeLocal(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}

export function fromDateTimeLocal(value: string) {
  if (!value) return null;
  return new Date(value).toISOString();
}

export function formatAmount(amount: number | string, currency: string) {
  return `${toPersianNumber(toFinanceAmount(amount))} ${currency}`;
}

export function billStatusOf(record: FinanceRecord, now = new Date()): BillStatus | null {
  if (record.record_type !== "BILL") return null;
  return deriveBillStatus(record, now);
}

export function billStatusLabel(status: BillStatus) {
  if (status === "PAID") return "پرداخت شده";
  if (status === "OVERDUE") return "معوق";
  if (status === "DUE") return "امروز";
  return "پیش‌رو";
}

export function billStatusTone(
  status: BillStatus,
): "success" | "danger" | "warning" | "neutral" {
  if (status === "PAID") return "success";
  if (status === "OVERDUE") return "danger";
  if (status === "DUE") return "warning";
  return "neutral";
}

export function memberDisplayName(
  members: { userId: string; fullName: string }[],
  userId: string | null | undefined,
) {
  if (!userId) return "کاربر";
  return members.find((member) => member.userId === userId)?.fullName || "کاربر";
}
