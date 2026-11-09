import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  Bell,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CircleCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  Clock3,
  LockKeyhole,
  RefreshCw,
} from "lucide-react";
import { directFinance } from "@/features/finance/direct-client";
import { formatAmount, getBillStatus } from "@/features/finance/bills";
import type { FinancialRecord } from "@/features/finance/types";
import {
  billCategories,
  billCategory,
  billsDashboard,
  shiftPersianMonth,
  type BillCategory,
} from "@/features/bills/model";
import { parseAmount } from "@/shared/utils/amount";
import "./bills.css";

const colors = {
  برق: "#e8b944",
  آب: "#4c9cc5",
  گاز: "#357da8",
  اینترنت: "#8d70a7",
  تلفن: "#77a978",
  سایر: "#927f6a",
};
const dateText = (value: string) =>
  new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(new Date(value));
function BillIcon({ category }: { category: BillCategory }) {
  return (
    <span
      className="bill-icon"
      data-category={category}
      style={{ "--icon-color": colors[category] } as React.CSSProperties}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {category === "برق" && (
          <path d="M27 3 11 25h10l-2 20 18-26H26z" fill="currentColor" />
        )}
        {category === "آب" && (
          <>
            <path
              d="M24 3C20 10 8 22 8 30a16 16 0 0 0 32 0C40 22 28 10 24 3Z"
              fill="currentColor"
            />
            <path
              d="M17 23c-3 6-3 12 2 15"
              stroke="#eaf6f9"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </>
        )}
        {category === "گاز" && (
          <>
            <path
              d="M27 3c2 9-4 10-2 18 2-3 4-5 5-9 9 7 12 14 10 22-2 7-8 11-16 11S10 40 9 33c-1-7 3-13 8-18 0 7 3 9 4 10C19 15 25 12 27 3Z"
              fill="currentColor"
            />
            <path
              d="M25 23c-2 6-7 8-7 13a7 7 0 0 0 14 0c0-5-4-9-7-13Z"
              fill="#d8eaf0"
            />
          </>
        )}
        {category === "اینترنت" && (
          <g stroke="currentColor" strokeWidth="4" strokeLinecap="round">
            <path d="M7 17c10-9 24-9 34 0M12 23c7-6 17-6 24 0M18 29c4-3 8-3 12 0" />
            <circle cx="24" cy="35" r="2.5" fill="currentColor" stroke="none" />
          </g>
        )}
        {category === "تلفن" && (
          <path
            d="M12 5c-2 0-5 4-5 7 0 12 17 29 29 29 3 0 7-3 7-5 0-1-7-8-9-8-2 0-4 3-6 4-4-2-10-8-12-12 1-2 4-4 4-6 0-2-7-9-8-9Z"
            fill="currentColor"
          />
        )}
        {category === "سایر" && (
          <path
            d="M29 13 17 25a7 7 0 0 0 10 10l12-12a11 11 0 0 0-16-16L10 20"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        )}
      </svg>
    </span>
  );
}
function BillAmount({
  amount,
  currency,
}: {
  amount: number | string;
  currency: string;
}) {
  const formatted = formatAmount(amount, currency);
  const unit = currency === "IRR" ? "تومان" : currency;
  const number = formatted.endsWith(unit)
    ? formatted.slice(0, -unit.length).trim()
    : formatted;
  return (
    <div className="bill-amount">
      <strong>{number}</strong>
      <small>{unit}</small>
    </div>
  );
}
export function Bills({
  client,
  householdId,
  onReminders,
  onFinance,
}: {
  client: SupabaseClient;
  householdId: string | null;
  onReminders: () => void;
  onFinance: () => void;
}) {
  const api = useMemo(() => directFinance(client), [client]);
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<BillCategory | null>(null);
  const [month, setMonth] = useState(() => new Date());
  const [allPending, setAllPending] = useState(false);
  const [allHistory, setAllHistory] = useState(false);
  const [form, setForm] = useState(false);
  const [kind, setKind] = useState<BillCategory>("برق");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [due, setDue] = useState("");
  const [note, setNote] = useState("");
  const [shared, setShared] = useState(false);
  const load = useCallback(async () => {
    try {
      setRecords(await api.list());
      setLoaded(true);
    } catch {
      setLoaded(false);
      setMessage(
        "دریافت قبض‌ها ناموفق بود؛ اتصال را بررسی و دوباره تلاش کنید.",
      );
    }
  }, [api]);
  useEffect(() => {
    void Promise.resolve().then(load);
    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [load]);
  const data = useMemo(() => billsDashboard(records, month), [records, month]);
  const pending = data.pending.filter(
    (r) => !category || billCategory(r) === category,
  );
  const history = data.paid.filter(
    (r) => !category || billCategory(r) === category,
  );
  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setMessage("");
    const value = parseAmount(amount);
    const dueDate = new Date(due);
    if (value === null || !due || Number.isNaN(dueDate.getTime())) {
      setMessage("مبلغ و زمان سررسید معتبر وارد کنید.");
      return;
    }
    setBusy(true);
    try {
      await api.create({
        title: title.trim() || `قبض ${kind}`,
        recordType: "BILL",
        visibility: shared ? "HOUSEHOLD_SHARED" : "PRIVATE",
        amount: value,
        currency: "IRR",
        category: kind,
        note: note.trim() || null,
        dueAt: dueDate.toISOString(),
        isRecurring: false,
      });
      setForm(false);
      setTitle("");
      setAmount("");
      setDue("");
      setNote("");
      setMessage("قبض ثبت شد. برای تنظیم اعلان، از بخش یادآورها استفاده کنید.");
      await load();
    } catch {
      setMessage("ثبت قبض تأیید نشد؛ پیش از تلاش دوباره فهرست را تازه کنید.");
    } finally {
      setBusy(false);
    }
  }
  async function markPaid(r: FinancialRecord) {
    if (
      busy ||
      !window.confirm(
        `آیا «${r.title}» پرداخت شده است؟ این گزینه پرداخت بانکی انجام نمی‌دهد.`,
      )
    )
      return;
    setBusy(true);
    setMessage("");
    try {
      await api.update(r.id, { paid: true }, r.updated_at);
      setMessage(
        "پرداخت در دفتر ثبت شد؛ برای مدیریت یادآور به بخش یادآورها بروید.",
      );
      await load();
    } catch {
      setMessage(
        "ثبت پرداخت تأیید نشد. فهرست را تازه کنید و دوباره بررسی کنید.",
      );
    } finally {
      setBusy(false);
    }
  }
  const now = new Date();
  let angle = 0;
  const stops = data.total
    ? data.categories
        .filter((c) => c.total > 0)
        .map((c) => {
          const start = angle;
          angle += (c.total / data.total) * 100;
          return `${colors[c.name]} ${start}% ${angle}%`;
        })
        .join(",")
    : "#ddd8cc 0% 100%";
  return (
    <div className="bills-page" dir="rtl">
      <header className="bills-hero">
        <div className="bills-brand">
          <svg className="bills-moon" viewBox="0 0 48 48" aria-hidden="true">
            <path
              fill="currentColor"
              d="M29 3a18 18 0 1 0 17 29A17 17 0 0 1 29 3Z"
            />
          </svg>{" "}
          KHOONEMOON{" "}
          <button
            type="button"
            className="bills-bell"
            aria-label="یادآورها"
            onClick={onReminders}
          >
            <Bell size={23} />
          </button>
        </div>
        <h1>
          قبوض و خدمات{" "}
          <svg className="bills-leaf" viewBox="0 0 60 90" aria-hidden="true">
            <path
              d="M8 85C17 64 28 44 50 7M21 58C10 60 8 50 7 46c9 0 16 4 16 10M31 39c-11 1-12-8-12-12 8 1 14 4 14 10M39 26c-1-9 4-14 9-17 2 8-1 14-9 17M28 49c9-9 17-7 21-6-5 7-12 9-21 6M19 65c8-7 15-6 19-4-5 6-11 8-19 4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </h1>
        <p>همه‌ی قبض‌ها و پرداخت‌های شما در یک‌جا</p>
      </header>
      <div className="bills-categories" aria-label="دسته‌بندی قبض‌ها">
        {billCategories.map((c) => (
          <button
            type="button"
            key={c}
            className="bills-category"
            data-category={c}
            aria-pressed={category === c}
            onClick={() => setCategory(category === c ? null : c)}
          >
            <BillIcon category={c} />
            <span>{c === "اینترنت" || c === "تلفن" ? c : `قبض ${c}`}</span>
          </button>
        ))}
      </div>
      {category && (
        <button
          type="button"
          className="bills-clear"
          onClick={() => setCategory(null)}
        >
          نمایش همه دسته‌ها ×
        </button>
      )}
      {message && (
        <p role="status" className="bills-message">
          {message}
        </p>
      )}
      {!loaded && (
        <p role="status">
          اطلاعات قبض‌ها بارگذاری نشده است.{" "}
          <button type="button" onClick={load}>
            <RefreshCw size={16} /> تلاش دوباره
          </button>
        </p>
      )}
      {loaded && (
        <>
          <section className="bills-sheet bills-upcoming">
            <div className="bills-sheet-head">
              <h2 className="bills-label">
                <Bell size={18} /> یادآوری پرداخت‌های پیش‌رو
              </h2>
              <button type="button" onClick={() => setAllPending(!allPending)}>
                {allPending ? "نمایش کمتر" : "مشاهده همه"} ‹
              </button>
            </div>
            {loaded && pending.length === 0 && (
              <p className="bills-empty">
                قبض پرداخت‌نشده‌ای {category ? "در این دسته" : ""} ندارید.
              </p>
            )}
            {(allPending ? pending : pending.slice(0, 3)).map((r) => {
              const status = getBillStatus({
                dueAt: r.due_at,
                paidAt: r.paid_at,
                now,
              });
              return (
                <div className="bill-row" key={r.id}>
                  <div className="bill-identity">
                    <BillIcon category={billCategory(r)} />
                    <div className="bill-name">
                      <strong>{r.title}</strong>
                      <small>{r.note || r.category || "قبض و خدمات"}</small>
                    </div>
                  </div>
                  <BillAmount amount={r.amount} currency={r.currency} />
                  <div className="bill-date">
                    <small>
                      {status === "OVERDUE" ? "سررسید گذشته" : "سررسید"}
                    </small>
                    {r.due_at ? dateText(r.due_at) : "—"}
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    aria-label={`ثبت پرداخت ${r.title}`}
                    className={`bill-status ${status === "OVERDUE" ? "overdue" : "upcoming"}`}
                    onClick={() => markPaid(r)}
                  >
                    {status === "OVERDUE" ? (
                      <AlertTriangle size={17} />
                    ) : (
                      <Clock3 size={17} />
                    )}
                    {status === "OVERDUE"
                      ? "سررسید گذشته"
                      : status === "DUE"
                        ? "نزدیک سررسید"
                        : "پیش‌رو"}
                  </button>
                </div>
              );
            })}
          </section>
          <div className="bills-bottom">
            <section className="bills-sheet bills-history">
              <h2 className="bills-label">تاریخچه قبوض</h2>
              {loaded && history.length === 0 && (
                <p className="bills-empty">
                  هنوز قبض پرداخت‌شده‌ای ثبت نشده است.
                </p>
              )}
              {(allHistory ? history : history.slice(0, 5)).map((r) => (
                <div className="bill-history-row" key={r.id}>
                  <div className="bill-identity">
                    <BillIcon category={billCategory(r)} />
                    <div className="bill-name">
                      <strong>{r.title}</strong>
                      <small>
                        {r.paid_at &&
                          new Intl.DateTimeFormat("fa-IR", {
                            month: "long",
                            year: "numeric",
                          }).format(new Date(r.paid_at))}
                      </small>
                    </div>
                  </div>
                  <BillAmount amount={r.amount} currency={r.currency} />
                  <span className="bill-paid">
                    <Check size={16} /> پرداخت‌شده
                  </span>
                </div>
              ))}
              <button
                type="button"
                className="bills-more"
                onClick={() => setAllHistory(!allHistory)}
              >
                {allHistory ? "نمایش کمتر" : "مشاهده همه"} ‹
              </button>
            </section>
            <section className="bills-sheet bills-summary">
              <h2 className="bills-label">خلاصه مخارج ماهانه</h2>
              <div className="bills-month">
                <button
                  type="button"
                  aria-label="ماه بعد"
                  onClick={() => setMonth(shiftPersianMonth(month, 1))}
                >
                  <ChevronRight size={19} />
                </button>
                <strong>
                  {new Intl.DateTimeFormat("fa-IR", {
                    month: "long",
                    year: "numeric",
                  }).format(month)}
                </strong>
                <button
                  type="button"
                  aria-label="ماه قبل"
                  onClick={() => setMonth(shiftPersianMonth(month, -1))}
                >
                  <ChevronLeft size={19} />
                </button>
              </div>
              <p>جمع کل پرداخت‌ها</p>
              <strong className="bills-total">
                {formatAmount(data.total, "IRR")}
              </strong>
              <div className="bills-chart">
                <div
                  className="bills-donut"
                  style={{ background: `conic-gradient(${stops})` }}
                  aria-label="نمودار سهم دسته‌ها"
                >
                  <span />
                </div>
                <ul>
                  {data.categories
                    .filter((c) => c.name !== "سایر" || c.total > 0)
                    .map((c) => (
                      <li key={c.name}>
                        <i style={{ background: colors[c.name] }} />
                        {c.name}
                        <b>{new Intl.NumberFormat("fa-IR").format(c.total)}</b>
                      </li>
                    ))}
                </ul>
              </div>
              {!data.total && (
                <p className="bills-empty">
                  در این ماه پرداختی به تومان ثبت نشده است.
                </p>
              )}
              <p className="bills-comparison">
                <CircleCheck size={17} aria-hidden="true" />
                {data.change === null
                  ? "ماه قبل پرداختی ثبت نشده است"
                  : data.change === 0
                    ? "برابر با ماه گذشته"
                    : `${Math.abs(data.change).toLocaleString("fa-IR", { maximumFractionDigits: 1 })}٪ ${data.change < 0 ? "کمتر" : "بیشتر"} از ماه گذشته`}
                {data.change !== null &&
                  data.change !== 0 &&
                  (data.change < 0 ? (
                    <ArrowDown size={17} aria-hidden="true" />
                  ) : (
                    <ArrowUp size={17} aria-hidden="true" />
                  ))}
              </p>
              <small>
                فقط قبض‌های پرداخت‌شده به تومان؛ سایر ارزها در تاریخچه دیده
                می‌شوند.
              </small>
            </section>
          </div>
        </>
      )}
      <div className="bills-utilities">
        <button type="button" onClick={() => void load()}>
          <RefreshCw size={15} /> تازه‌سازی
        </button>
        <button type="button" onClick={onFinance}>
          ویرایش قبوض در بخش مالی
        </button>
        <button type="button" onClick={onReminders}>
          تنظیم یادآور
        </button>
      </div>
      <button
        type="button"
        className="bills-add"
        onClick={() => setForm(!form)}
      >
        <span className="bills-add-tag" aria-hidden="true">
          <span>+</span>
        </span>
        <CirclePlus /> {form ? "بستن فرم" : "افزودن قبض جدید"}
      </button>
      {form && (
        <form className="bills-form bills-sheet" onSubmit={save}>
          <h2>ثبت قبض جدید</h2>
          <label>
            نوع قبض
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as BillCategory)}
            >
              {[...billCategories, "سایر"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            عنوان (اختیاری)
            <input
              value={title}
              maxLength={180}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`قبض ${kind}`}
            />
          </label>
          <label>
            مبلغ به تومان
            <input
              inputMode="decimal"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label>
            زمان سررسید
            <input
              type="datetime-local"
              required
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </label>
          <label>
            توضیح یا نام شرکت
            <input
              value={note}
              maxLength={1000}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          {householdId && (
            <label className="bills-check">
              <input
                type="checkbox"
                checked={shared}
                onChange={(e) => setShared(e.target.checked)}
              />{" "}
              مشترک با اعضای خانه
            </label>
          )}
          <button type="submit" disabled={busy}>
            {busy ? "در حال ذخیره…" : "ذخیره قبض"}
          </button>
        </form>
      )}
      <p className="bills-privacy">
        <LockKeyhole size={14} /> اطلاعات شما امن و محفوظ است.
      </p>
    </div>
  );
}
