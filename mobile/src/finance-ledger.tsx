import {
  Archive,
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Check,
  CreditCard,
  FileText,
  House,
  Pencil,
  Search,
  Settings,
  RefreshCw,
  ShoppingBasket,
  UserRound,
  Utensils,
  Wallet,
  Wifi,
  X,
  Clock3,
} from "lucide-react";
import type { FinanceAnalytics } from "@/features/finance/analytics";
import {
  formatAmount,
  getBillStatus,
  isBillRecord,
} from "@/features/finance/bills";
import type { FinanceSummary } from "@/features/finance/bills";
import {
  LEDGER_TYPES,
  PAID_LABELS,
  TYPE_LABELS,
  type LedgerFilters,
  type LedgerType,
} from "@/features/finance/ledger";
import type { FinancialRecord } from "@/features/finance/types";
import { FinanceChart } from "./finance-chart";
import "./finance-ledger.css";

export type FinanceAccountScope = "ALL" | "PRIVATE" | "SHARED";

function amountOnly(amount: number | string, currency: string) {
  const value = formatAmount(amount, currency);
  return currency === "IRR" ? value.replace(/\sتومان$/, "") : value;
}

function recordPaymentState(record: FinancialRecord, now: Date) {
  if (record.paid_at) return "PAID" as const;
  if (record.record_type === "DEBT") return "WAITING" as const;
  if (!record.due_at) return "PAID" as const;
  return getBillStatus({ dueAt: record.due_at, paidAt: null, now }) ===
    "OVERDUE"
    ? ("UNPAID" as const)
    : ("WAITING" as const);
}

function recordIcon(record: FinancialRecord) {
  if (record.record_type === "INCOME") return Wallet;
  if (record.record_type === "BILL") return FileText;
  if (record.record_type === "SUBSCRIPTION") return Wifi;
  if (record.record_type === "INSTALLMENT") return CreditCard;
  if (record.record_type === "DEBT") return UserRound;
  if (record.category === "خوراک" || record.category === "رستوران")
    return Utensils;
  return ShoppingBasket;
}

function jalaliDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function FilterPills<T extends string>({
  className,
  label,
  selected,
  options,
  onSelect,
}: {
  className: string;
  label: string;
  selected: T;
  options: { value: T; label: string }[];
  onSelect: (value: T) => void;
}) {
  return (
    <div
      className={`fin-ledger-filter-row ${className}`}
      role="group"
      aria-label={label}
    >
      {options.map(({ value, label: text }) => (
        <button
          key={value}
          type="button"
          className={selected === value ? "active" : ""}
          aria-pressed={selected === value}
          onClick={() => onSelect(value)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function StatusPill({ state }: { state: "PAID" | "UNPAID" | "WAITING" }) {
  const label =
    state === "PAID"
      ? PAID_LABELS.PAID
      : state === "UNPAID"
        ? PAID_LABELS.UNPAID
        : PAID_LABELS.WAITING;
  const Icon = state === "PAID" ? Check : state === "UNPAID" ? X : Clock3;
  return (
    <span className={`fin-ledger-status ${state.toLowerCase()}`}>
      <Icon size={14} aria-hidden="true" />
      {label}
    </span>
  );
}

export function FinanceLedger({
  records,
  summary,
  resultCount,
  unpaidBillsCount,
  analytics,
  filters,
  accountScope,
  currency,
  currencies,
  dateFrom,
  dateTo,
  now,
  busy,
  sync,
  categoryFilter,
  onAccountScope,
  onCurrency,
  onRefresh,
  onDateFrom,
  onDateTo,
  onType,
  onPaid,
  onQuery,
  onResetFilters,
  onClearCategory,
  onBack,
  onSettings,
  onRecord,
  onPaidRecord,
  onArchive,
  onAdd,
}: {
  records: FinancialRecord[];
  summary: FinanceSummary;
  resultCount: number;
  unpaidBillsCount: number;
  analytics: FinanceAnalytics;
  filters: LedgerFilters;
  accountScope: FinanceAccountScope;
  currency: string;
  currencies: string[];
  dateFrom: string;
  dateTo: string;
  now: Date;
  busy: boolean;
  sync: string;
  categoryFilter: string;
  onAccountScope: (scope: FinanceAccountScope) => void;
  onCurrency: (currency: string) => void;
  onRefresh: () => void;
  onDateFrom: (value: string) => void;
  onDateTo: (value: string) => void;
  onType: (type: LedgerType) => void;
  onPaid: (paid: LedgerFilters["paid"]) => void;
  onQuery: (query: string) => void;
  onResetFilters: () => void;
  onClearCategory: () => void;
  onBack?: () => void;
  onSettings?: () => void;
  onRecord: (record: FinancialRecord) => void;
  onPaidRecord: (record: FinancialRecord) => void;
  onArchive: (record: FinancialRecord) => void;
  onAdd: () => void;
}) {
  const typeOptions = LEDGER_TYPES.map((value) => ({
    value,
    label: TYPE_LABELS[value],
  }));
  const paidOptions: { value: LedgerFilters["paid"]; label: string }[] = [
    { value: "ALL", label: "همه وضعیت‌ها" },
    { value: "PAID", label: PAID_LABELS.PAID },
    { value: "UNPAID", label: PAID_LABELS.UNPAID },
    { value: "WAITING", label: PAID_LABELS.WAITING },
  ];
  const activeFilters =
    filters.type !== "ALL" ||
    filters.paid !== "ALL" ||
    filters.days !== "ALL" ||
    Boolean(filters.query) ||
    Boolean(dateFrom) ||
    Boolean(dateTo) ||
    Boolean(categoryFilter);
  const statCards = [
    {
      kind: "expense",
      label: "مجموع هزینه‌ها",
      value: amountOnly(summary.expense, currency),
      note: currency === "IRR" ? "تومان" : currency,
      Icon: ArrowDownRight,
    },
    {
      kind: "income",
      label: "مجموع درآمد",
      value: amountOnly(summary.income, currency),
      note: currency === "IRR" ? "تومان" : currency,
      Icon: ArrowUpRight,
    },
    {
      kind: "unpaid",
      label: "قبض‌های پرداخت‌نشده",
      value: amountOnly(summary.outstanding, currency),
      note: `${unpaidBillsCount.toLocaleString("fa-IR")} مورد`,
      Icon: FileText,
    },
  ];

  return (
    <div className="fin-ledger">
      <header className="fin-ledger-header">
        <div className="fin-ledger-heading-copy">
          <h2>دفتر مالی</h2>
          <p>مدیریت ساده، آینده روشن‌تر</p>
        </div>
        <div className="fin-ledger-heading-tools">
          <label className="fin-account-select">
            <span className="sr-only">انتخاب حساب</span>
            <select
              aria-label="حساب مالی"
              value={accountScope}
              onChange={(event) =>
                onAccountScope(event.target.value as FinanceAccountScope)
              }
            >
              <option value="ALL">همه حساب‌ها</option>
              <option value="PRIVATE">شخصی</option>
              <option value="SHARED">مشترک</option>
            </select>
          </label>
          {onBack && (
            <button
              className="fin-ledger-icon-button"
              type="button"
              onClick={onBack}
              aria-label="بازگشت به خانه"
              title="بازگشت"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          {onSettings && (
            <button
              className="fin-ledger-icon-button"
              type="button"
              onClick={onSettings}
              aria-label="تنظیمات"
              title="تنظیمات"
            >
              <Settings size={18} />
            </button>
          )}
        </div>
      </header>

      <div className="fin-ledger-tools">
        <p className="finance-sync" aria-live="polite">
          {sync}
        </p>
        <label className="fin-ledger-currency">
          <span className="sr-only">ارز گزارش</span>
          <select
            aria-label="ارز گزارش"
            value={currency}
            onChange={(event) => onCurrency(event.target.value)}
          >
            {currencies.map((code) => (
              <option key={code} value={code}>
                {code === "IRR" ? "تومان" : code}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="fin-ledger-refresh"
          aria-label="تازه‌سازی دفتر مالی"
          title="تازه‌سازی"
          onClick={onRefresh}
        >
          <RefreshCw size={16} />
        </button>
      </div>

      <section className="fin-ledger-stats" aria-label="خلاصه مالی">
        {statCards.map(({ kind, label, value, note, Icon }) => (
          <article className={`fin-ledger-stat ${kind}`} key={kind}>
            <span className="fin-ledger-stat-icon">
              <Icon size={20} />
            </span>
            <strong>{label}</strong>
            <b>{value}</b>
            <small>{note}</small>
          </article>
        ))}
      </section>

      <section
        className="fin-ledger-chart-card"
        aria-label="نمودار شش ماه اخیر"
      >
        <div className="fin-ledger-chart-plot">
          <FinanceChart analytics={analytics} currency={currency} />
        </div>
        <div className="fin-ledger-chart-legend">
          <h3>نمودار ۶ ماه اخیر</h3>
          <span>
            <i className="income" /> درآمد
          </span>
          <span>
            <i className="expense" /> هزینه
          </span>
        </div>
      </section>

      <section className="fin-ledger-filters" aria-label="فیلتر دفتر مالی">
        <FilterPills
          className="fin-ledger-type-filters"
          label="نوع تراکنش"
          selected={filters.type}
          options={typeOptions}
          onSelect={onType}
        />
        <FilterPills
          className="fin-ledger-status-filters"
          label="وضعیت پرداخت"
          selected={filters.paid}
          options={paidOptions}
          onSelect={onPaid}
        />
        <div className="fin-ledger-query-row">
          <div className="fin-ledger-date-controls">
            <label>
              <span className="sr-only">تا تاریخ</span>
              <input
                type="date"
                aria-label="تا تاریخ"
                lang="fa-IR"
                value={dateTo}
                onChange={(event) => onDateTo(event.target.value)}
              />
            </label>
            <ArrowLeft size={17} aria-hidden="true" />
            <label>
              <span className="sr-only">از تاریخ</span>
              <input
                type="date"
                aria-label="از تاریخ"
                lang="fa-IR"
                value={dateFrom}
                onChange={(event) => onDateFrom(event.target.value)}
              />
            </label>
            <CalendarDays size={19} aria-hidden="true" />
          </div>
          <label className="fin-ledger-search">
            <span className="sr-only">جست‌وجو در عنوان تراکنش</span>
            <Search size={20} aria-hidden="true" />
            <input
              type="search"
              value={filters.query}
              placeholder="جست‌وجو در عنوان تراکنش..."
              onChange={(event) => onQuery(event.target.value)}
            />
          </label>
        </div>
        <div className="fin-ledger-filter-foot">
          {activeFilters && (
            <button
              type="button"
              className="fin-ledger-reset"
              onClick={onResetFilters}
            >
              پاک‌کردن فیلترها
            </button>
          )}
          {categoryFilter && (
            <button
              type="button"
              className="fin-ledger-reset"
              onClick={onClearCategory}
            >
              حذف دستهٔ «{categoryFilter}»
            </button>
          )}
        </div>
      </section>

      {records.length ? (
        <table
          className="fin-ledger-table"
          aria-label={`تراکنش‌های مالی، ${resultCount.toLocaleString("fa-IR")} مورد`}
        >
          <colgroup>
            <col className="title" />
            <col className="category" />
            <col className="date" />
            <col className="amount" />
            <col className="status" />
            <col className="actions" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">عنوان</th>
              <th scope="col">دسته‌بندی</th>
              <th scope="col">تاریخ</th>
              <th scope="col">مبلغ</th>
              <th scope="col">وضعیت</th>
              <th scope="col">
                <span className="sr-only">عملیات</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => {
              const Icon = recordIcon(record);
              const state = recordPaymentState(record, now);
              const date =
                record.paid_at ?? record.due_at ?? record.occurred_at;
              const canTogglePayment =
                isBillRecord(record) ||
                (record.record_type === "EXPENSE" && Boolean(record.due_at));
              const actions = [
                {
                  title: "ویرایش",
                  label: `ویرایش ${record.title}`,
                  Icon: Pencil,
                  run: () => onRecord(record),
                },
                ...(canTogglePayment &&
                !(
                  record.paid_at &&
                  record.is_recurring &&
                  record.recurrence_rule
                )
                  ? [
                      {
                        title: record.paid_at
                          ? "بازگرداندن پرداخت"
                          : "پرداخت شد",
                        label: record.paid_at
                          ? `بازگرداندن پرداخت ${record.title}`
                          : `پرداخت ${record.title}`,
                        Icon: Check,
                        run: () => onPaidRecord(record),
                      },
                    ]
                  : []),
                {
                  title: "بایگانی",
                  label: `بایگانی ${record.title}`,
                  Icon: Archive,
                  run: () => onArchive(record),
                },
              ];
              return (
                <tr key={record.id}>
                  <td className="fin-ledger-title-cell">
                    <span
                      className={`fin-ledger-record-icon ${record.record_type.toLowerCase()}`}
                    >
                      <Icon size={19} aria-hidden="true" />
                    </span>
                    <span className="fin-ledger-title-copy">
                      <strong>{record.title}</strong>
                      <small>
                        {record.visibility === "PRIVATE" ? (
                          <>
                            <House size={11} aria-hidden="true" /> شخصی
                          </>
                        ) : (
                          <>
                            <UserRound size={11} aria-hidden="true" /> مشترک
                          </>
                        )}
                      </small>
                    </span>
                  </td>
                  <td>
                    <span
                      className={`fin-ledger-category ${record.record_type.toLowerCase()}`}
                    >
                      {record.category || TYPE_LABELS[record.record_type]}
                    </span>
                  </td>
                  <td>
                    <time
                      className="fin-ledger-date"
                      dateTime={date ?? undefined}
                    >
                      {jalaliDate(date)}
                    </time>
                  </td>
                  <td>
                    <strong
                      className={`fin-ledger-amount ${record.record_type === "INCOME" ? "positive" : "negative"}`}
                    >
                      {amountOnly(record.amount, record.currency)}
                    </strong>
                  </td>
                  <td>
                    <StatusPill state={state} />
                  </td>
                  <td>
                    <span className="fin-ledger-actions">
                      {actions.map(({ title, label, Icon, run }) => (
                        <button
                          key={title}
                          type="button"
                          aria-label={label}
                          title={title}
                          disabled={busy}
                          onClick={run}
                        >
                          <Icon size={17} />
                        </button>
                      ))}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <div className="fin-ledger-empty">با این فیلترها تراکنشی پیدا نشد.</div>
      )}

      <button className="fin-add" type="button" onClick={onAdd}>
        <span aria-hidden="true">＋</span> ثبت تراکنش جدید
      </button>
    </div>
  );
}
