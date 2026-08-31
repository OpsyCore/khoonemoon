import type {
  CreateFinanceRecordInput,
  UpdateFinanceRecordInput,
} from "@/features/finance/schemas";
import {
  validateFinancePaidBy,
  type FinanceMembership,
} from "@/features/finance/security";
import type {
  FinanceRecord,
  FinanceVisibility,
} from "@/features/finance/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export function requireFinanceUserId(userId: string | null | undefined) {
  if (!userId) {
    throw new Error("UNAUTHORIZED");
  }

  return userId;
}

export async function getCurrentFinanceMembership(userId: string) {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", userId)
    .is("left_at", null)
    .maybeSingle();

  if (error) {
    throw new Error("FAILED_TO_LOAD_MEMBERSHIP");
  }

  return data;
}

export function resolveCreateFinanceHousehold({
  visibility,
  activeHouseholdId,
}: {
  visibility: FinanceVisibility;
  activeHouseholdId: string | null;
}) {
  if (visibility === "HOUSEHOLD_SHARED") {
    if (!activeHouseholdId) {
      throw new Error("NO_HOUSEHOLD_FOR_SHARED_FINANCE");
    }

    return activeHouseholdId;
  }

  return null;
}

export async function validateCreateFinanceForUser({
  userId,
  input,
}: {
  userId: string;
  input: CreateFinanceRecordInput;
}) {
  requireFinanceUserId(userId);

  const membership = await getCurrentFinanceMembership(userId);
  const householdId = resolveCreateFinanceHousehold({
    visibility: input.visibility,
    activeHouseholdId: membership?.household_id ?? null,
  });

  return { householdId };
}

export function toCreateFinanceRpcArgs(input: CreateFinanceRecordInput) {
  return {
    p_record_type: input.recordType,
    p_title: input.title,
    p_amount: input.amount,
    p_currency: input.currency,
    p_visibility: input.visibility,
    p_due_at: input.recordType === "BILL" ? (input.dueAt ?? null) : null,
    p_occurred_at:
      input.recordType === "EXPENSE" ? (input.occurredAt ?? null) : null,
    p_category: input.category ?? null,
    p_note: input.note ?? null,
  };
}

export type FinanceUpdateRpcInput = {
  title: string;
  amount: number;
  currency: string;
  dueAt: string | null;
  occurredAt: string | null;
  category: string | null;
  note: string | null;
};

export function toFinanceUpdateRpcInput({
  existing,
  patch,
}: {
  existing: FinanceRecord;
  patch: UpdateFinanceRecordInput;
}): FinanceUpdateRpcInput {
  return {
    title: patch.title ?? existing.title,
    amount: patch.amount !== undefined ? patch.amount : Number(existing.amount),
    currency: patch.currency ?? existing.currency,
    dueAt:
      existing.record_type === "BILL"
        ? patch.dueAt === undefined
          ? existing.due_at
          : patch.dueAt
        : null,
    occurredAt:
      existing.record_type === "EXPENSE"
        ? patch.occurredAt === undefined
          ? existing.occurred_at
          : patch.occurredAt
        : null,
    category: patch.category === undefined ? existing.category : patch.category,
    note: patch.note === undefined ? existing.note : patch.note,
  };
}

export function toUpdateFinanceRpcArgs(
  id: string,
  input: FinanceUpdateRpcInput,
) {
  return {
    p_id: id,
    p_title: input.title,
    p_amount: input.amount,
    p_currency: input.currency,
    p_due_at: input.dueAt,
    p_occurred_at: input.occurredAt,
    p_category: input.category,
    p_note: input.note,
  };
}

export function resolveFinancePaidBy({
  viewerId,
  ownerId,
  visibility,
  householdId,
  paidBy,
  memberships,
}: {
  viewerId: string;
  ownerId: string;
  visibility: FinanceVisibility;
  householdId: string | null;
  paidBy?: string | null;
  memberships: readonly FinanceMembership[];
}) {
  const resolved = paidBy ?? viewerId;

  if (
    !validateFinancePaidBy({
      visibility,
      ownerId,
      householdId,
      paidBy: resolved,
      memberships,
    })
  ) {
    throw new Error("INVALID_FINANCE_PAID_BY");
  }

  return resolved;
}

export function toSetFinancePaidRpcArgs({
  id,
  paid,
  paidBy,
}: {
  id: string;
  paid: boolean;
  paidBy: string | null;
}) {
  if (!paid) {
    return {
      p_id: id,
      p_paid: false,
      p_paid_by: null,
    };
  }

  return {
    p_id: id,
    p_paid: true,
    p_paid_by: paidBy,
  };
}

export function sortFinanceRecords(records: FinanceRecord[]): FinanceRecord[] {
  const unpaidBills = records
    .filter((record) => record.record_type === "BILL" && !record.paid_at)
    .sort((a, b) => (a.due_at ?? "").localeCompare(b.due_at ?? ""));

  const expenses = records
    .filter((record) => record.record_type === "EXPENSE")
    .sort((a, b) => (b.occurred_at ?? "").localeCompare(a.occurred_at ?? ""));

  const paidBills = records
    .filter((record) => record.record_type === "BILL" && record.paid_at)
    .sort((a, b) => (b.paid_at ?? "").localeCompare(a.paid_at ?? ""));

  return [...unpaidBills, ...expenses, ...paidBills];
}

export function mapFinanceError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("UNAUTHORIZED")) {
    return "برای این عملیات باید وارد حساب شوید.";
  }
  if (message.includes("NO_HOUSEHOLD_FOR_SHARED_FINANCE")) {
    return "برای ثبت مورد اشتراکی باید عضو یک خانه باشید.";
  }
  if (message.includes("FINANCE_NOT_FOUND")) {
    return "مورد مالی یافت نشد.";
  }
  if (message.includes("FINANCE_ACCESS_DENIED")) {
    return "به این مورد مالی دسترسی ندارید.";
  }
  if (message.includes("FINANCE_NOT_A_BILL")) {
    return "فقط قبض را می‌توان پرداخت‌شده علامت زد.";
  }
  if (message.includes("INVALID_FINANCE_PAID_BY")) {
    return "پرداخت‌کننده انتخاب‌شده معتبر نیست.";
  }
  if (message.includes("INVALID_FINANCE_TITLE")) {
    return "عنوان نمی‌تواند خالی باشد.";
  }
  if (message.includes("INVALID_FINANCE_AMOUNT")) {
    return "مبلغ باید بزرگ‌تر از صفر باشد.";
  }
  if (message.includes("INVALID_BILL_DUE_AT")) {
    return "برای قبض، تاریخ سررسید الزامی است.";
  }
  if (message.includes("INVALID_EXPENSE_OCCURRED_AT")) {
    return "برای هزینه، تاریخ وقوع الزامی است.";
  }
  if (message.includes("INVALID_FINANCE_RECORD_TYPE")) {
    return "نوع مورد مالی معتبر نیست.";
  }
  if (message.includes("FINANCE_RECORD_IMMUTABLE_FIELDS")) {
    return "مالکیت و نوع نمایش مورد مالی قابل تغییر نیست.";
  }
  if (message.includes("FAILED_TO_LOAD_MEMBERSHIP")) {
    return "دریافت عضویت خانه ناموفق بود.";
  }

  return "انجام عملیات مالی ناموفق بود.";
}

export function financeErrorStatus(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("UNAUTHORIZED")) return 401;
  if (message.includes("FINANCE_NOT_FOUND")) return 404;
  if (message.includes("FINANCE_ACCESS_DENIED")) return 403;
  if (message.includes("FAILED_TO_LOAD_MEMBERSHIP")) return 500;
  return 400;
}

export function financeErrorCode(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  const codes = [
    "UNAUTHORIZED",
    "NO_HOUSEHOLD_FOR_SHARED_FINANCE",
    "FINANCE_NOT_FOUND",
    "FINANCE_ACCESS_DENIED",
    "FINANCE_NOT_A_BILL",
    "INVALID_FINANCE_TITLE",
    "INVALID_FINANCE_AMOUNT",
    "INVALID_BILL_DUE_AT",
    "INVALID_EXPENSE_OCCURRED_AT",
    "INVALID_FINANCE_PAID_BY",
    "INVALID_FINANCE_RECORD_TYPE",
    "FINANCE_RECORD_IMMUTABLE_FIELDS",
    "FAILED_TO_LOAD_MEMBERSHIP",
  ] as const;

  return codes.find((code) => message.includes(code)) ?? null;
}
