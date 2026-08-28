import { fromDateTimeLocal } from "./finance-display";
import type { FinanceFormState } from "./finance-form";
import type { FinanceRecordType } from "@/features/finance/types";

export function canPayFinanceRecord(recordType: FinanceRecordType) {
  return recordType === "BILL";
}

export function canStartFinanceMutation(pendingId: string | null) {
  return pendingId == null;
}

export function validateFinanceFormClient(
  form: FinanceFormState,
  recordType: FinanceRecordType,
) {
  const title = form.title.trim();
  if (!title) {
    return "عنوان را وارد کنید.";
  }
  if (title.length > 180) {
    return "عنوان نمی‌تواند بیشتر از ۱۸۰ کاراکتر باشد.";
  }

  const amount = Number(form.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return "مبلغ باید یک عدد مثبت باشد.";
  }

  const currency = form.currency.trim() || "IRR";
  if (currency.length < 3 || currency.length > 8) {
    return "واحد پول معتبر نیست.";
  }

  if (form.category.trim().length > 80) {
    return "دسته‌بندی نمی‌تواند بیشتر از ۸۰ کاراکتر باشد.";
  }

  if (form.note.trim().length > 1000) {
    return "یادداشت نمی‌تواند بیشتر از ۱۰۰۰ کاراکتر باشد.";
  }

  if (recordType === "BILL" && !form.dueAt) {
    return "تاریخ سررسید قبض را وارد کنید.";
  }

  if (recordType === "EXPENSE" && !form.occurredAt) {
    return "تاریخ وقوع هزینه را وارد کنید.";
  }

  return null;
}

export function buildCreateFinancePayload(
  form: FinanceFormState,
  canShare: boolean,
) {
  const amount = Number(form.amount);
  const base = {
    recordType: form.recordType,
    title: form.title.trim(),
    amount,
    currency: form.currency.trim() || "IRR",
    visibility: canShare ? form.visibility : "PRIVATE",
    category: form.category.trim() || null,
    note: form.note.trim() || null,
  };

  if (form.recordType === "BILL") {
    return {
      ...base,
      dueAt: fromDateTimeLocal(form.dueAt),
    };
  }

  return {
    ...base,
    occurredAt: fromDateTimeLocal(form.occurredAt),
  };
}

export function buildUpdateFinancePayload(
  form: FinanceFormState,
  recordType: FinanceRecordType,
) {
  const amount = Number(form.amount);
  const base = {
    title: form.title.trim(),
    amount,
    currency: form.currency.trim() || "IRR",
    category: form.category.trim() || null,
    note: form.note.trim() || null,
  };

  if (recordType === "BILL") {
    return {
      ...base,
      dueAt: fromDateTimeLocal(form.dueAt),
    };
  }

  return {
    ...base,
    occurredAt: fromDateTimeLocal(form.occurredAt),
  };
}

export function buildPayAction() {
  return { action: "pay" as const };
}

export function buildUnpayAction() {
  return { action: "unpay" as const };
}

export function buildUpdateAction(
  form: FinanceFormState,
  recordType: FinanceRecordType,
) {
  return {
    action: "update" as const,
    data: buildUpdateFinancePayload(form, recordType),
  };
}
