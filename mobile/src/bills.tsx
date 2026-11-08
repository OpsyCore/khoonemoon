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
  Check,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  Clock3,
  Droplet,
  Flame,
  LockKeyhole,
  Paperclip,
  Phone,
  RefreshCw,
  Wifi,
  Zap,
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

const icons = {
  برق: Zap,
  آب: Droplet,
  گاز: Flame,
  اینترنت: Wifi,
  تلفن: Phone,
  سایر: Paperclip,
};
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
  const Icon = icons[category];
  return (
    <span
      className="bill-icon"
      style={{ "--icon-color": colors[category] } as React.CSSProperties}
    >
      <Icon
        aria-hidden="true"
        size={25}
        fill={
          category === "اینترنت" || category === "سایر"
            ? "none"
            : "currentColor"
        }
      />
    </span>
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
          <span>☾</span> KHOONEMOON{" "}
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
          قبوض و خدمات <span aria-hidden="true">❧</span>
        </h1>
        <p>همه‌ی قبض‌ها و پرداخت‌های شما در یک‌جا</p>
      </header>
      <div className="bills-categories" aria-label="دسته‌بندی قبض‌ها">
        {billCategories.map((c) => (
          <button
            type="button"
            key={c}
            className="bills-category"
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
                  <BillIcon category={billCategory(r)} />
                  <div className="bill-name">
                    <strong>{r.title}</strong>
                    <small>{r.note || r.category || "قبض و خدمات"}</small>
                  </div>
                  <div className="bill-amount">
                    {formatAmount(r.amount, r.currency)}
                  </div>
                  <div className="bill-date">
                    <small>
                      {status === "OVERDUE" ? "سررسید گذشته" : "سررسید"}
                    </small>
                    {r.due_at ? dateText(r.due_at) : "—"}
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    className={`bill-status ${status === "OVERDUE" ? "overdue" : "upcoming"}`}
                    onClick={() => markPaid(r)}
                  >
                    <Clock3 size={17} />
                    {status === "OVERDUE"
                      ? "سررسید گذشته"
                      : status === "DUE"
                        ? "نزدیک سررسید"
                        : "پیش‌رو"}
                    <small>ثبت پرداخت</small>
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
                  <BillIcon category={billCategory(r)} />
                  <div className="bill-name">
                    <strong>{r.title}</strong>
                    <small>{r.paid_at && dateText(r.paid_at)}</small>
                  </div>
                  <div className="bill-amount">
                    {formatAmount(r.amount, r.currency)}
                  </div>
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
                    .filter((c) => c.total > 0)
                    .map((c) => (
                      <li key={c.name}>
                        <i style={{ background: colors[c.name] }} />
                        {c.name}
                        <b>{formatAmount(c.total, "IRR")}</b>
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
                {data.change === null
                  ? "برای مقایسه، ماه قبل پرداختی ثبت نشده است."
                  : `${Math.abs(data.change).toLocaleString("fa-IR", { maximumFractionDigits: 1 })}٪ ${data.change <= 0 ? "کمتر" : "بیشتر"} از ماه گذشته`}
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
