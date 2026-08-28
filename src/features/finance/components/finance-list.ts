import { toFinanceAmount } from "@/features/finance/status";
import type { FinanceRecord } from "@/features/finance/types";

export type FinanceTypeFilter = "ALL" | "BILL" | "EXPENSE";
export type FinancePaidFilter = "ALL" | "UNPAID" | "PAID";

export type FinanceTotals = {
  currency: string;
  unpaidBills: number;
  paidBills: number;
  expenses: number;
};

export function filterFinanceRecords(
  records: readonly FinanceRecord[],
  type: FinanceTypeFilter,
  paid: FinancePaidFilter,
): FinanceRecord[] {
  return records.filter((record) => {
    if (type !== "ALL" && record.record_type !== type) {
      return false;
    }

    if (type === "EXPENSE" || paid === "ALL") {
      return true;
    }

    if (record.record_type !== "BILL") {
      return false;
    }

    return paid === "PAID" ? Boolean(record.paid_at) : !record.paid_at;
  });
}

export function summarizeFinanceRecords(
  records: readonly FinanceRecord[],
): FinanceTotals[] {
  const byCurrency = new Map<string, FinanceTotals>();

  for (const record of records) {
    const currency = record.currency.trim() || "IRR";
    const current = byCurrency.get(currency) ?? {
      currency,
      unpaidBills: 0,
      paidBills: 0,
      expenses: 0,
    };
    const amount = toFinanceAmount(record.amount);

    if (record.record_type === "EXPENSE") {
      current.expenses += amount;
    } else if (record.paid_at) {
      current.paidBills += amount;
    } else {
      current.unpaidBills += amount;
    }

    byCurrency.set(currency, current);
  }

  return [...byCurrency.values()];
}
