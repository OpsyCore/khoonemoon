export type FinancialRecordType =
  | "EXPENSE"
  | "INCOME"
  | "BILL"
  | "SUBSCRIPTION"
  | "INSTALLMENT"
  | "DEBT";

export type BillStatus = "UPCOMING" | "DUE" | "PAID" | "OVERDUE";
export type FinancialVisibility = "PRIVATE" | "HOUSEHOLD_SHARED";

export type FinancialRecord = {
  id: string;
  household_id: string | null;
  owner_id: string;
  created_by: string;
  visibility: FinancialVisibility;
  record_type: FinancialRecordType;
  title: string;
  amount: number | string;
  currency: string;
  category: string | null;
  note: string | null;
  occurred_at: string;
  due_at: string | null;
  bill_status: BillStatus | null;
  is_recurring: boolean;
  recurrence_rule: string | null;
  paid_by: string | null;
  paid_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};
