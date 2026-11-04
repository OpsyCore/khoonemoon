import type { SearchKind } from "./filters";

/** Recent searches are stored only on this device, separately per signed-in user. */
export function recentQueries(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.trim())
        .filter((v) => v.length >= 2 && v.length <= 100),
    ),
  ].slice(0, 6);
}
export function rememberQuery(history: string[], query: string): string[] {
  return recentQueries([query, ...history.filter((v) => v !== query)]);
}
export function matchParts(
  title: string,
  query: string,
): { before: string; match: string; after: string } | null {
  const q = query.trim();
  const index = q
    ? title.toLocaleLowerCase().indexOf(q.toLocaleLowerCase())
    : -1;
  return index < 0
    ? null
    : {
        before: title.slice(0, index),
        match: title.slice(index, index + q.length),
        after: title.slice(index + q.length),
      };
}
export function resultStatus(
  kind: SearchKind,
  value: string | null,
): string | null {
  const statuses: Partial<Record<SearchKind, Record<string, string>>> = {
    task: {
      PENDING: "در انتظار",
      IN_PROGRESS: "در حال انجام",
      COMPLETED: "انجام شد",
      SKIPPED: "رد شده",
    },
    shopping_item: { PURCHASED: "خریداری شد", PENDING: "در انتظار" },
    chore: { ACTIVE: "فعال", PAUSED: "متوقف" },
    finance: {
      PAID: "پرداخت‌شده",
      DUE: "سررسیده",
      OVERDUE: "معوق",
      UPCOMING: "پیش‌رو",
      EXPENSE: "هزینه",
      INCOME: "درآمد",
      BILL: "قبض",
      SUBSCRIPTION: "اشتراک",
      INSTALLMENT: "قسط",
      DEBT: "بدهی",
    },
    event: { PRIVATE: "شخصی", HOUSEHOLD_SHARED: "مشترک" },
  };
  return value ? (statuses[kind]?.[value] ?? null) : null;
}
