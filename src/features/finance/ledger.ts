import type {
  FinancialRecord,
  FinancialRecordType,
} from "@/features/finance/types";

/**
 * Financial ledger ("دفتر تراکنش‌ها").
 *
 * The finance tab only ever showed the latest 100 records with no way to look at
 * a slice: "how much did we spend on bills last month?" had no answer. The ledger
 * filters server-side from the URL, so a filtered view is a shareable link and no
 * client JavaScript is needed.
 */

export type LedgerType = FinancialRecordType | "ALL";

export const LEDGER_TYPES: LedgerType[] = [
  "ALL",
  "EXPENSE",
  "INCOME",
  "BILL",
  "SUBSCRIPTION",
  "INSTALLMENT",
  "DEBT",
];

export const TYPE_LABELS: Record<LedgerType, string> = {
  ALL: "همه",
  EXPENSE: "هزینه",
  INCOME: "درآمد",
  BILL: "قبض",
  SUBSCRIPTION: "اشتراک",
  INSTALLMENT: "قسط",
  DEBT: "بدهی",
};

export type PaidFilter = "ALL" | "PAID" | "UNPAID";

export const PAID_LABELS: Record<PaidFilter, string> = {
  ALL: "همه",
  PAID: "پرداخت‌شده",
  UNPAID: "پرداخت‌نشده",
};

export type LedgerDays = "ALL" | "30" | "90" | "365";

export const DAYS_LABELS: Record<LedgerDays, string> = {
  ALL: "همه",
  "30": "۳۰ روز",
  "90": "۹۰ روز",
  "365": "۱ سال",
};

export type LedgerFilters = {
  type: LedgerType;
  paid: PaidFilter;
  days: LedgerDays;
  /** Free-text match over title, category and note. */
  query: string;
};

export const DEFAULT_LEDGER_FILTERS: LedgerFilters = {
  type: "ALL",
  paid: "ALL",
  days: "ALL",
  query: "",
};

const DAY_MS = 24 * 60 * 60 * 1000;

function isLedgerType(value: string): value is LedgerType {
  return LEDGER_TYPES.includes(value as LedgerType);
}

export function parseLedgerFilters(params: URLSearchParams): LedgerFilters {
  const type = (params.get("type") ?? "").toUpperCase();
  const paid = (params.get("paid") ?? "").toUpperCase();
  const days = params.get("days") ?? "";

  return {
    type: isLedgerType(type) ? type : "ALL",
    paid: paid in PAID_LABELS ? (paid as PaidFilter) : "ALL",
    days: days in DAYS_LABELS ? (days as LedgerDays) : "ALL",
    query: (params.get("q") ?? "").trim(),
  };
}

/** Serialises only the non-default filters, so the plain ledger URL stays clean. */
export function toLedgerQuery(filters: LedgerFilters): string {
  const params = new URLSearchParams();

  if (filters.type !== "ALL") params.set("type", filters.type);
  if (filters.paid !== "ALL") params.set("paid", filters.paid);
  if (filters.days !== "ALL") params.set("days", filters.days);
  if (filters.query) params.set("q", filters.query);

  return params.toString();
}

export function hasLedgerFilters(filters: LedgerFilters): boolean {
  return (
    filters.type !== "ALL" ||
    filters.paid !== "ALL" ||
    filters.days !== "ALL" ||
    filters.query.length > 0
  );
}

/** The date a record belongs to: when it was paid, else due, else when it happened. */
export function ledgerDate(
  record: Pick<FinancialRecord, "paid_at" | "due_at" | "occurred_at">,
): Date | null {
  const raw = record.paid_at ?? record.due_at ?? record.occurred_at;
  if (!raw) return null;

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * The date a record is *ordered* by: when money moved (paid) or when it was
 * recorded. Deliberately ignores `due_at`, otherwise an unpaid bill due next
 * month would sit at the top of a newest-first ledger.
 */
export function activityDate(
  record: Pick<FinancialRecord, "paid_at" | "occurred_at">,
): Date | null {
  const raw = record.paid_at ?? record.occurred_at;
  if (!raw) return null;

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function matchesQuery(record: FinancialRecord, query: string): boolean {
  if (!query) return true;

  const needle = query.toLocaleLowerCase("fa");
  const haystack = [record.title, record.category, record.note]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLocaleLowerCase("fa");

  return haystack.includes(needle);
}

/**
 * A record with no usable date is kept when the range filter is off, but excluded
 * from a dated view: it cannot be proven to fall inside the window.
 */
export function matchesLedgerFilters({
  record,
  filters,
  now,
}: {
  record: FinancialRecord;
  filters: LedgerFilters;
  now: Date;
}): boolean {
  if (record.archived_at) return false;

  if (filters.type !== "ALL" && record.record_type !== filters.type)
    return false;

  if (filters.paid === "PAID" && !record.paid_at) return false;
  if (filters.paid === "UNPAID" && record.paid_at) return false;

  if (filters.days !== "ALL") {
    const date = ledgerDate(record);
    if (!date) return false;

    const cutoff = now.getTime() - Number(filters.days) * DAY_MS;

    // One day of slack on the far end so "today" is included in any timezone.
    if (date.getTime() < cutoff || date.getTime() > now.getTime() + DAY_MS) {
      return false;
    }
  }

  return matchesQuery(record, filters.query);
}

export type LedgerSummary = {
  count: number;
  income: number;
  expense: number;
  /** Bills that are not paid yet, inside the current filter. */
  outstanding: number;
  currency: string;
};

export function filterLedger({
  records,
  filters,
  now,
}: {
  records: FinancialRecord[];
  filters: LedgerFilters;
  now: Date;
}): { records: FinancialRecord[]; summary: LedgerSummary } {
  const matched = records
    .filter((record) => matchesLedgerFilters({ record, filters, now }))
    // Newest first, with undated rows last instead of jumping to the top.
    .sort((a, b) => {
      const aTime = activityDate(a)?.getTime() ?? Number.NEGATIVE_INFINITY;
      const bTime = activityDate(b)?.getTime() ?? Number.NEGATIVE_INFINITY;
      return bTime - aTime;
    });

  const summary = matched.reduce<LedgerSummary>(
    (totals, record) => {
      const amount = Number(record.amount) || 0;
      totals.count += 1;

      if (record.record_type === "INCOME") {
        totals.income += amount;
      } else {
        totals.expense += amount;
      }

      const isBill =
        record.record_type === "BILL" ||
        record.record_type === "SUBSCRIPTION" ||
        record.record_type === "INSTALLMENT";

      if (isBill && !record.paid_at) totals.outstanding += amount;

      return totals;
    },
    { count: 0, income: 0, expense: 0, outstanding: 0, currency: "IRR" },
  );

  summary.currency = matched[0]?.currency ?? "IRR";

  return { records: matched, summary };
}
