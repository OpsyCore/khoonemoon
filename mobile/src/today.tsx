import { spendingComparison } from "./weekly-comparison";
import {
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  CreditCard,
  House,
  ListTodo,
  Wallet,
  AlertCircle,
} from "lucide-react";
import {
  getMobileWeeklySummary,
  type MobileWeeklySummary,
} from "@/features/summary/direct-client";
import { formatAmount } from "@/features/finance/bills";
import { formatPersianDate } from "@/shared/utils/locale";
import "./today.css";
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getToday } from "@/features/summary/today-client";
import { completeTodayChore, payTodayBill } from "./today-actions";
type Today = Awaited<ReturnType<typeof getToday>>;
type Page = "tasks" | "calendar" | "finance" | "reminders";
export function Today({
  client,
  onNavigate,
  onTaskChanged,
}: {
  client: SupabaseClient;
  onNavigate: (page: Page, section?: "task-list" | "chore-list") => void;
  onTaskChanged: () => void;
}) {
  const [value, setValue] = useState<Today | null>(null),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<MobileWeeklySummary | null>(null);
  const [summaryError, setSummaryError] = useState(false);
  useEffect(() => {
    let alive = true;
    void getMobileWeeklySummary(client, new Date())
      .then((data) => {
        if (alive) {
          setSummary(data);
          setSummaryError(false);
        }
      })
      .catch(() => {
        if (alive) {
          setSummary(null);
          setSummaryError(true);
        }
      });
    return () => {
      alive = false;
    };
  }, [client, version]);
  async function completeTask(id: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { error: result } = await client.rpc("mobile_complete_task", {
        p_task_id: id,
      });
      if (result) throw result;
      setValue((current) =>
        current
          ? {
              ...current,
              tasks: current.tasks.filter((task) => task.id !== id),
            }
          : null,
      );
      onTaskChanged();
      window.dispatchEvent(new Event("khoonemoon:schedule-changed"));
    } catch {
      setValue(null);
      setError(
        "وضعیت انجام تسک تأیید نشد؛ پیش از تلاش دوباره امروز را تازه‌سازی کنید.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function doTodayAction(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
      onTaskChanged();
      window.dispatchEvent(new Event("khoonemoon:schedule-changed"));
    } catch {
      setValue(null);
      setError("عملیات تأیید نشد؛ پیش از تلاش دوباره وضعیت را تازه‌سازی کنید.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let alive = true;
    void getToday(client, new Date())
      .then((v) => {
        if (alive) {
          setValue(v);
          setError("");
        }
      })
      .catch(() => {
        if (alive) {
          setValue(null);
          setError("دریافت اطلاعات امروز ناموفق بود.");
        }
      });
    return () => {
      alive = false;
    };
  }, [client, version]);
  useEffect(() => {
    const changed = () => setVersion((n) => n + 1);
    window.addEventListener("khoonemoon:schedule-changed", changed);
    return () =>
      window.removeEventListener("khoonemoon:schedule-changed", changed);
  }, []);
  const dateTime = (at: string | null) => {
    if (!at || Number.isNaN(new Date(at).getTime())) return "";
    return new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(at));
  };
  const today = new Date();
  const daysLeft = (at: string | null) => {
    if (!at) return "بدون سررسید";
    const date = new Date(at);
    if (Number.isNaN(date.getTime())) return "سررسید نامعتبر";
    const day = (d: Date) =>
      Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    const days = Math.round((day(date) - day(today)) / 86400000);
    if (days < 0) return `${Math.abs(days).toLocaleString("fa-IR")} روز معوق`;
    if (days === 0) return "امروز";
    return `${days.toLocaleString("fa-IR")} روز مانده`;
  };
  return (
    <div className="today-ref" dir="rtl">
      <div className="today-ref-greeting">
        <div>
          <strong>سلام، روزتون بخیر</strong>
          <button onClick={() => onNavigate("tasks", "task-list")}>
            کارهای من
          </button>
        </div>
        <span className="today-ref-greeting-art" aria-hidden="true" />
        <small>
          زندگی بهتر
          <br />
          با هم قشنگ‌تره
        </small>
      </div>
      <div className="today-ref-hero">
        <div>
          <strong>{formatPersianDate(today)}</strong>
          <span>
            روزهای معمولی
            <br />
            هم می‌تونن خاص باشن
          </span>
        </div>
      </div>
      <div className="today-ref-summary">
        <h2>
          <BarChart3 size={21} /> خلاصه این هفته
        </h2>
        <p>هفت روز گذشته تا اکنون؛ مبالغ هر ارز جداگانه</p>
        {summaryError ? (
          <p role="alert">دریافت خلاصه هفتگی ناموفق بود.</p>
        ) : !summary ? (
          <p role="status">در حال دریافت خلاصه…</p>
        ) : (
          <div className="today-ref-stats">
            <div>
              <span>
                <Check size={22} />
              </span>
              <strong>
                {summary.counts.tasksDone.toLocaleString("fa-IR")} مورد
              </strong>
              <small>کارهای انجام‌شده</small>
            </div>
            <div>
              <span>
                <House size={21} />
              </span>
              <strong>
                {summary.counts.choresDone.toLocaleString("fa-IR")} مورد
              </strong>
              <small>کارهای خانه انجام‌شده</small>
            </div>
            <div>
              <span>
                <Wallet size={21} />
              </span>
              <strong>
                {summary.sharedCurrencies.filter((c) => c.summary.spent > 0)
                  .length
                  ? summary.sharedCurrencies
                      .filter((c) => c.summary.spent > 0)
                      .map((c) => (
                        <span key={c.currency}>
                          {formatAmount(c.summary.spent, c.currency)}
                        </span>
                      ))
                  : "بدون هزینه مشترک"}
              </strong>
              <small>هزینه‌های مشترک ثبت‌شده</small>
            </div>
          </div>
        )}
        {summary && (
          <details className="today-ref-week-details">
            <summary>جزئیات و مقایسه با هفته قبل</summary>
            <p>
              کارهای انجام‌شده هفته قبل:{" "}
              {summary.counts.tasksDonePrevious.toLocaleString("fa-IR")} ·
              کارهای خانه هفته قبل:{" "}
              {summary.counts.choresDonePrevious.toLocaleString("fa-IR")}
            </p>
            {summary.currencies.map(({ currency, summary: totals }) => (
              <p key={currency}>
                گزارش کل {currency}: {formatAmount(totals.spent, currency)} ·
                هفته قبل: {formatAmount(totals.spentPrevious, currency)} ·
                درآمد: {formatAmount(totals.earned, currency)} ·{" "}
                {spendingComparison(totals.spentChange)}
              </p>
            ))}
            <p>
              گزارش کل شامل موارد مالی ثبت‌شده نیز هست؛ مبالغ به هم تبدیل
              نمی‌شوند. هزینه مشترک شامل بدهی و قبض پرداخت‌نشده نیست.
            </p>
          </details>
        )}
      </div>
      {error && (
        <p className="today-ref-error" role="alert">
          {error}
        </p>
      )}
      {!value && !error && <p role="status">در حال دریافت اطلاعات امروز…</p>}
      {value && (
        <div className="today-ref-grid">
          <div className="today-ref-card today-ref-tasks">
            <h3>
              <ListTodo size={20} /> کارهای امروز و معوق
            </h3>
            {value.tasks.length ? (
              value.tasks.slice(0, 5).map((t) => (
                <div className="today-ref-row" key={t.id}>
                  <span className="today-ref-text">
                    <strong>{t.title}</strong>
                    <small>{dateTime(t.due_at)}</small>
                  </span>
                  {t.priority && ["HIGH", "CRITICAL"].includes(t.priority) && (
                    <span
                      className="today-ref-priority"
                      aria-label="اولویت بالا"
                    >
                      !
                    </span>
                  )}
                  <button
                    className="today-ref-check"
                    aria-label={`انجام ${t.title}`}
                    disabled={busy}
                    onClick={() => void completeTask(t.id)}
                  >
                    <Check size={15} />
                  </button>
                </div>
              ))
            ) : (
              <p>کاری برای امروز یا معوق نیست.</p>
            )}
            <button
              className="today-ref-more"
              onClick={() => onNavigate("tasks", "task-list")}
            >
              دیدن همه ←
            </button>
          </div>
          <div className="today-ref-card today-ref-events">
            <h3>
              <CalendarDays size={20} /> رویدادهای پیش رو
            </h3>
            {value.upcomingEvents.length ? (
              value.upcomingEvents.slice(0, 3).map((e) => (
                <button
                  className="today-ref-item"
                  key={e.id}
                  onClick={() => onNavigate("calendar")}
                >
                  <span className="today-ref-icon">
                    <CalendarDays size={18} />
                  </span>
                  <span>
                    <strong>{e.title}</strong>
                    <small>{dateTime(e.start_at)}</small>
                  </span>
                </button>
              ))
            ) : (
              <p>در هفت روز آینده رویدادی نیست.</p>
            )}
            <button
              className="today-ref-more"
              onClick={() => onNavigate("calendar")}
            >
              دیدن تقویم ←
            </button>
          </div>
          <div className="today-ref-card today-ref-chores">
            <h3>
              <House size={20} /> کارهای خانه
            </h3>
            {value.chores.length ? (
              value.chores.slice(0, 4).map((c) => (
                <div className="today-ref-row" key={c.id}>
                  <span className="today-ref-text">
                    <strong>{c.title}</strong>
                    <small>{dateTime(c.next_due_at)}</small>
                  </span>
                  <button
                    className="today-ref-check"
                    aria-label={`انجام ${c.title}`}
                    disabled={busy || !c.next_due_at}
                    onClick={() => {
                      if (
                        c.next_due_at &&
                        window.confirm("انجام این کار خانه ثبت شود؟")
                      )
                        void doTodayAction(() =>
                          completeTodayChore(client, c.id, c.next_due_at!),
                        );
                    }}
                  >
                    <Check size={15} />
                  </button>
                </div>
              ))
            ) : (
              <p>کار خانه‌ای برای امروز یا معوق نیست.</p>
            )}
            <button
              className="today-ref-more"
              onClick={() => onNavigate("tasks", "chore-list")}
            >
              دیدن همه ←
            </button>
          </div>
          <div className="today-ref-card today-ref-bills">
            <h3>
              <CreditCard size={20} /> قبض‌ها و پرداخت‌ها
            </h3>
            {value.upcomingBills.length ? (
              value.upcomingBills.slice(0, 3).map((b) => (
                <div className="today-ref-item today-ref-bill" key={b.id}>
                  <span className="today-ref-icon">
                    <AlertCircle size={18} />
                  </span>
                  <span className="today-ref-text">
                    <strong>{b.title}</strong>
                    <small>{dateTime(b.due_at)}</small>
                  </span>
                  <span className="today-ref-days">{daysLeft(b.due_at)}</span>
                  <button
                    className="today-ref-pay"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm("این قبض پرداخت شده است؟"))
                        void doTodayAction(() => payTodayBill(client, b.id));
                    }}
                  >
                    پرداخت شد
                  </button>
                </div>
              ))
            ) : (
              <p>قبضی معوق یا در هفت روز آینده نیست.</p>
            )}
            <button
              className="today-ref-more"
              onClick={() => onNavigate("finance")}
            >
              دیدن مالی ←
            </button>
          </div>
          <div className="today-ref-card today-ref-reminders">
            <h3>
              <Bell size={20} /> یادآورهای امروز و معوق
            </h3>
            {value.reminders.length ? (
              value.reminders.slice(0, 4).map((r) => (
                <button
                  className="today-ref-item"
                  key={r.id}
                  onClick={() => onNavigate("reminders")}
                >
                  <span className="today-ref-icon">
                    <Bell size={18} />
                  </span>
                  <span>
                    <strong>{r.title ?? "یادآور"}</strong>
                    <small>
                      {dateTime(
                        r.status === "SNOOZED" && r.snoozed_until
                          ? r.snoozed_until
                          : r.remind_at,
                      )}
                    </small>
                  </span>
                </button>
              ))
            ) : (
              <p>یادآور فعالی برای امروز یا معوق نیست.</p>
            )}
            <button
              className="today-ref-more"
              onClick={() => onNavigate("reminders")}
            >
              دیدن همه ←
            </button>
          </div>
        </div>
      )}
      <div className="today-ref-footer">
        <span className="today-ref-books" aria-hidden="true" />
        <p>
          با هم، خانه فقط یک مکان نیست
          <br />
          یک حس خوبه ...
        </p>
        <span className="today-ref-footer-leaf" aria-hidden="true" />
      </div>
      <button
        className="today-ref-refresh"
        onClick={() => setVersion((n) => n + 1)}
      >
        تازه‌سازی امروز و خلاصه
      </button>
    </div>
  );
}
