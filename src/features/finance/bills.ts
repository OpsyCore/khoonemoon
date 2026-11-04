import type { BillStatus, FinancialRecord } from "@/features/finance/types";

const BILL_TYPES = new Set(["BILL", "SUBSCRIPTION", "INSTALLMENT"]);

export function isBillRecord(record: Pick<FinancialRecord, "record_type">) {
  return BILL_TYPES.has(record.record_type);
}

/**
 * Mirrors the database trigger so the UI can show an up-to-date state without
 * a round-trip after every render.
 */
export function getBillStatus({
  dueAt,
  paidAt,
  now,
}: {
  dueAt: string | null;
  paidAt?: string | null;
  now: Date;
}): BillStatus {
  if (paidAt) return "PAID";
  if (!dueAt) return "UPCOMING";

  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return "UPCOMING";

  if (due.getTime() < now.getTime()) return "OVERDUE";

  const threeDaysAhead = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  if (due.getTime() < threeDaysAhead.getTime()) return "DUE";

  return "UPCOMING";
}

export function formatAmount(
  amount: number | string,
  currency = "IRR",
): string {
  const value = typeof amount === "string" ? Number(amount) : amount;

  if (!Number.isFinite(value)) return "—";

  const formatted = new Intl.NumberFormat("fa-IR", {
    maximumFractionDigits: currency === "IRR" ? 0 : 2,
  }).format(currency === "IRR" ? Math.round(value) : value);

  return currency === "IRR" ? `${formatted} تومان` : `${formatted} ${currency}`;
}

export type FinanceSummary = {
  income: number;
  expense: number;
  outstanding: number;
  overdueCount: number;
  dueSoonCount: number;
};

export function summarizeFinance(
  records: FinancialRecord[],
  now: Date,
): FinanceSummary {
  return records.reduce<FinanceSummary>(
    (summary, record) => {
      const amount = Number(record.amount) || 0;

      if (record.archived_at) return summary;

      if (record.record_type === "INCOME") {
        summary.income += amount;
        return summary;
      }

      if (isBillRecord(record)) {
        const status = getBillStatus({
          dueAt: record.due_at,
          paidAt: record.paid_at,
          now,
        });

        if (status !== "PAID") {
          summary.outstanding += amount;
          if (status === "OVERDUE") summary.overdueCount += 1;
          if (status === "DUE") summary.dueSoonCount += 1;
        }

        return summary;
      }

      summary.expense += amount;
      return summary;
    },
    { income: 0, expense: 0, outstanding: 0, overdueCount: 0, dueSoonCount: 0 },
  );
}
