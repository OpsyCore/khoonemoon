export const FINANCE_RECORD_TYPES = ["EXPENSE", "BILL"] as const;
export type FinanceRecordType = (typeof FINANCE_RECORD_TYPES)[number];

export const FINANCE_VISIBILITIES = ["PRIVATE", "HOUSEHOLD_SHARED"] as const;
export type FinanceVisibility = (typeof FINANCE_VISIBILITIES)[number];

export type BillStatus = "PAID" | "OVERDUE" | "DUE" | "UPCOMING";

/**
 * Persisted finance_records row (PostgREST/DB field names, same as TaskRecord).
 * Bill status is derived and is not stored on this model.
 */
export type FinanceRecord = {
  id: string;
  record_type: FinanceRecordType;
  title: string;
  amount: number | string;
  currency: string;
  owner_id: string;
  created_by: string;
  household_id: string | null;
  visibility: FinanceVisibility;
  due_at: string | null;
  occurred_at: string | null;
  paid_at: string | null;
  paid_by: string | null;
  category: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export const FINANCE_RECORD_SELECT =
  "id, record_type, title, amount, currency, owner_id, created_by, household_id, visibility, due_at, occurred_at, paid_at, paid_by, category, note, created_at, updated_at" as const;

export type FinanceMember = {
  userId: string;
  fullName: string;
};

export type TodayBillItem = {
  id: FinanceRecord["id"];
  title: FinanceRecord["title"];
  amount: number;
  currency: FinanceRecord["currency"];
  dueAt: string;
  overdue: boolean;
  category: FinanceRecord["category"];
  note: FinanceRecord["note"];
  status?: BillStatus;
};
