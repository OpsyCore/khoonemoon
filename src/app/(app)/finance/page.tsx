import Link from "next/link";
import { FinanceRecordActions } from "@/features/finance/components/finance-record-actions";
import {
  formatAmount,
  getBillStatus,
  isBillRecord,
} from "@/features/finance/bills";
import {
  DAYS_LABELS,
  LEDGER_TYPES,
  PAID_LABELS,
  TYPE_LABELS,
  filterLedger,
  hasLedgerFilters,
  parseLedgerFilters,
  toLedgerQuery,
  type LedgerDays,
  type PaidFilter,
} from "@/features/finance/ledger";
import type { FinancialRecord } from "@/features/finance/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Badge } from "@/shared/ui/badge";
import { Card, CardDescription, CardTitle } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { ErrorState } from "@/shared/ui/error-state";
import { formatPersianShortDate, toPersianNumber } from "@/shared/utils/locale";
import { cn } from "@/shared/utils/cn";

export const dynamic = "force-dynamic";

const RECORD_SELECT =
  "id, household_id, owner_id, created_by, visibility, record_type, title, amount, currency, category, note, occurred_at, due_at, bill_status, is_recurring, recurrence_rule, paid_by, paid_at, archived_at, created_at, updated_at";

const PAID_OPTIONS: PaidFilter[] = ["ALL", "PAID", "UNPAID"];
const DAYS_OPTIONS: LedgerDays[] = ["ALL", "30", "90", "365"];

function FilterLink({
  href,
  isActive,
  children,
}: {
  href: string;
  isActive: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={isActive ? "true" : undefined}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-medium transition",
        isActive
          ? "border-sky-500 bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200"
          : "border-zinc-200 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
      )}
    >
      {children}
    </Link>
  );
}

/**
 * دفتر تراکنش‌ها — every financial record, filterable from the URL.
 *
 * Filtering happens on the server from `searchParams`, so a filtered view is a
 * shareable link and the page ships no filtering JavaScript.
 */
export default async function FinanceLedgerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const urlParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") urlParams.set(key, value);
  }

  const filters = parseLedgerFilters(urlParams);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <ErrorState
        title="دسترسی غیرمجاز"
        description="برای دیدن تراکنش‌ها باید وارد حساب شوید."
      />
    );
  }

  const { data, error } = await supabase
    .from("financial_records")
    .select(RECORD_SELECT)
    .is("archived_at", null)
    .order("occurred_at", { ascending: false })
    .limit(500);

  if (error) {
    return (
      <ErrorState
        title="خطا در بارگذاری تراکنش‌ها"
        description="اطلاعات مالی قابل دریافت نیست. لطفاً دوباره تلاش کنید."
      />
    );
  }

  const now = new Date();
  const all = (data ?? []) as FinancialRecord[];
  const { records, summary } = filterLedger({ records: all, filters, now });
  const isFiltered = hasLedgerFilters(filters);

  const buildHref = (patch: Record<string, string>) => {
    const next = { ...filters, ...patch };
    const query = toLedgerQuery(next);

    return query ? `/finance?${query}` : "/finance";
  };

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">دفتر تراکنش‌ها</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          همهٔ درآمدها، هزینه‌ها و قبض‌ها با فیلتر نوع، وضعیت پرداخت و بازهٔ
          زمانی. هر فیلتر یک نشانی قابل اشتراک دارد.
        </p>
      </section>

      <Card className="space-y-3">
        <div className="space-y-1.5">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">نوع</p>
          <div className="flex flex-wrap gap-1.5">
            {LEDGER_TYPES.map((type) => (
              <FilterLink
                key={type}
                href={buildHref({ type })}
                isActive={filters.type === type}
              >
                {TYPE_LABELS[type]}
              </FilterLink>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">پرداخت</p>
          <div className="flex flex-wrap gap-1.5">
            {PAID_OPTIONS.map((paid) => (
              <FilterLink
                key={paid}
                href={buildHref({ paid })}
                isActive={filters.paid === paid}
              >
                {PAID_LABELS[paid]}
              </FilterLink>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">بازه</p>
          <div className="flex flex-wrap gap-1.5">
            {DAYS_OPTIONS.map((days) => (
              <FilterLink
                key={days}
                href={buildHref({ days })}
                isActive={filters.days === days}
              >
                {DAYS_LABELS[days]}
              </FilterLink>
            ))}
          </div>
        </div>

        {filters.query ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            جست‌وجو برای «{filters.query}» —{" "}
            <Link
              href={buildHref({ q: "" })}
              className="text-sky-700 underline dark:text-sky-300"
            >
              پاک‌کردن
            </Link>
          </p>
        ) : null}

        {isFiltered ? (
          <Link
            href="/finance"
            className="inline-block text-xs text-sky-700 underline dark:text-sky-300"
          >
            پاک‌کردن همهٔ فیلترها
          </Link>
        ) : null}
      </Card>

      <div className="grid grid-cols-3 gap-2">
        <Card className="space-y-1 p-3">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">درآمد</p>
          <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            {formatAmount(summary.income, summary.currency)}
          </p>
        </Card>
        <Card className="space-y-1 p-3">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">هزینه</p>
          <p className="text-sm font-semibold">
            {formatAmount(summary.expense, summary.currency)}
          </p>
        </Card>
        <Card className="space-y-1 p-3">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            قبض پرداخت‌نشده
          </p>
          <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
            {formatAmount(summary.outstanding, summary.currency)}
          </p>
        </Card>
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {toPersianNumber(summary.count)} تراکنش
        {isFiltered ? ` از ${toPersianNumber(all.length)}` : ""}
      </p>

      {records.length === 0 ? (
        <EmptyState
          title={
            isFiltered ? "با این فیلترها چیزی نیست" : "هنوز تراکنشی ثبت نشده"
          }
          description={
            isFiltered
              ? "فیلترها را پاک کنید یا بازهٔ زمانی را بازتر کنید."
              : "با ثبت هزینه یا قبض، این دفتر پر می‌شود."
          }
        />
      ) : (
        <ul className="space-y-2">
          {records.map((record) => {
            const status = isBillRecord(record)
              ? getBillStatus({
                  dueAt: record.due_at,
                  paidAt: record.paid_at,
                  now,
                })
              : null;
            const date = record.paid_at ?? record.due_at ?? record.occurred_at;

            return (
              <li key={record.id}>
                <Card className="space-y-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-0.5">
                      <CardTitle>{record.title}</CardTitle>
                      <CardDescription>
                        {TYPE_LABELS[record.record_type]}
                        {record.category ? ` · ${record.category}` : ""}
                        {date ? ` · ${formatPersianShortDate(date)}` : ""}
                      </CardDescription>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <p className="text-sm font-semibold tabular-nums">
                        {formatAmount(record.amount, record.currency)}
                      </p>
                      {status ? (
                        <Badge
                          tone={
                            status === "PAID"
                              ? "success"
                              : status === "OVERDUE"
                                ? "danger"
                                : status === "DUE"
                                  ? "warning"
                                  : "neutral"
                          }
                        >
                          {status === "PAID"
                            ? "پرداخت‌شده"
                            : status === "OVERDUE"
                              ? "معوق"
                              : status === "DUE"
                                ? "سررسید نزدیک"
                                : "پیش‌رو"}
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  <FinanceRecordActions record={record} />
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
