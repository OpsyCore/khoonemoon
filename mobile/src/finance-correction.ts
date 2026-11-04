import type { FinancialRecord } from "@/features/finance/types";
import { updateFinancialRecordSchema } from "@/features/finance/schemas";
import { parseAmount } from "@/shared/utils/amount";
import { taskEditTime } from "./task-edit-time";

/** Compare validated values to the exact displayed snapshot; preserve untouched timestamps. */
export function financeCorrection(
  record: FinancialRecord,
  form: {
    title: string;
    amount: string;
    category: string;
    note: string;
    due: string;
  },
) {
  const amount = parseAmount(form.amount);
  if (amount === null) throw new Error("مبلغ معتبر وارد کنید.");
  const dueAt = taskEditTime(
    form.due,
    record.due_at,
    null,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ).dueAt;
  if (
    ["BILL", "SUBSCRIPTION", "INSTALLMENT"].includes(record.record_type) &&
    !dueAt
  )
    throw new Error("تاریخ سررسید قبض یا قسط لازم است.");
  const values = updateFinancialRecordSchema.parse({
    title: form.title,
    amount,
    category: form.category.trim() || null,
    note: form.note.trim() || null,
    dueAt,
  });
  const patch: typeof values = {};
  if (values.title !== record.title) patch.title = values.title;
  if (values.amount !== Number(record.amount)) patch.amount = values.amount;
  if (values.category !== (record.category ?? null))
    patch.category = values.category;
  if (values.note !== (record.note ?? null)) patch.note = values.note;
  const originalDue = record.due_at?.endsWith("+00:00")
    ? record.due_at.slice(0, -6) + "Z"
    : record.due_at;
  if (dueAt !== originalDue) patch.dueAt = dueAt;
  return patch;
}
export const financePatchLabels = {
  title: "عنوان",
  amount: "مبلغ",
  category: "دسته",
  note: "یادداشت",
  dueAt: "سررسید",
  paid: "پرداخت",
} as const;
