import { parseAmount } from "@/shared/utils/amount";
import type { FinancialRecord } from "@/features/finance/types";

/**
 * Correcting a financial record ("اصلاح رکورد مالی").
 *
 * The API could already PATCH and archive a record, but nothing in the UI used
 * it: a typo in an amount stayed forever and quietly skewed the settlement and
 * the charts. These helpers turn an edit form into the smallest valid patch.
 *
 * The endpoint rejects an empty patch (`تغییری ارسال نشد.`), so the diff is
 * computed here instead of sending every field and hoping.
 */

export type EditableRecord = Pick<
  FinancialRecord,
  "title" | "amount" | "category" | "due_at"
>;

export type CorrectionForm = {
  title: string;
  amount: string;
  category: string;
  /** Value of an `<input type="datetime-local">`, or "" for no due date. */
  dueAt: string;
};

export type RecordPatch = {
  title?: string;
  amount?: number;
  category?: string | null;
  note?: string | null;
  dueAt?: string | null;
};

export type CorrectionResult =
  | { ok: true; patch: RecordPatch; unchanged: boolean }
  | { ok: false; field: "title" | "amount" | "category"; message: string };

export function toCorrectionForm(record: EditableRecord): CorrectionForm {
  return {
    title: record.title,
    // A numeric amount with no formatting: the field is for editing, not reading.
    amount: String(Number(record.amount) || 0),
    category: record.category ?? "",
    dueAt: toLocalDateTimeValue(record.due_at),
  };
}

/** `2026-11-01T09:30:00Z` → `2026-11-01T13:00` in the browser's timezone. */
export function toLocalDateTimeValue(iso: string | null): string {
  if (!iso) return "";

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

/** `2026-11-01T13:00` (local) → ISO, or null when the field is empty. */
export function fromLocalDateTimeValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * Builds the patch for a record being corrected.
 *
 * Only fields whose value actually changed are included, so:
 *  - the endpoint never receives an empty patch,
 *  - an untouched field cannot be "fixed" into something else,
 *  - the confirmation message can honestly say what changed.
 */
export function buildCorrectionPatch({
  record,
  form,
}: {
  record: EditableRecord;
  form: CorrectionForm;
}): CorrectionResult {
  const patch: RecordPatch = {};

  const title = normalizeText(form.title);
  if (title.length < 2) {
    return {
      ok: false,
      field: "title",
      message: "عنوان باید حداقل ۲ کاراکتر باشد.",
    };
  }
  if (title.length > 180) {
    return {
      ok: false,
      field: "title",
      message: "عنوان بیش از حد طولانی است.",
    };
  }
  if (title !== normalizeText(record.title)) patch.title = title;

  const amount = parseAmount(form.amount);
  if (amount === null) {
    return { ok: false, field: "amount", message: "مبلغ را به عدد وارد کنید." };
  }
  if (amount > 1_000_000_000_000) {
    return { ok: false, field: "amount", message: "مبلغ بیش از حد بزرگ است." };
  }
  if (amount !== Number(record.amount)) patch.amount = amount;

  const category = normalizeText(form.category);
  if (category.length > 60) {
    return {
      ok: false,
      field: "category",
      message: "دسته بیش از حد طولانی است.",
    };
  }
  const currentCategory = normalizeText(record.category ?? "");
  if (category !== currentCategory) patch.category = category || null;

  const dueAt = fromLocalDateTimeValue(form.dueAt);
  const currentDueAt = record.due_at
    ? new Date(record.due_at).toISOString()
    : null;
  if (dueAt !== currentDueAt) patch.dueAt = dueAt;

  return {
    ok: true,
    patch,
    unchanged: Object.keys(patch).length === 0,
  };
}

const FIELD_LABELS: Record<keyof RecordPatch, string> = {
  title: "عنوان",
  amount: "مبلغ",
  category: "دسته",
  note: "یادداشت",
  dueAt: "سررسید",
};

/** `["مبلغ", "دسته"]` — used in the confirmation text after saving. */
export function describePatch(patch: RecordPatch): string[] {
  return (Object.keys(patch) as (keyof RecordPatch)[]).map(
    (key) => FIELD_LABELS[key],
  );
}

/**
 * Deleting a financial record archives it (`archived_at`), it does not drop the
 * row, so the UI must not promise a permanent delete.
 */
export const DELETE_ACTION_LABEL = "بایگانی";
export const DELETE_ACTION_HINT =
  "رکورد از همهٔ فهرست‌ها، تسویه‌حساب و نمودارها کنار می‌رود، ولی سابقه‌اش در دیتابیس می‌ماند.";
