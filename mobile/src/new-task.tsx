import { useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  Ban,
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Flag,
  LockKeyhole,
  Pencil,
  RefreshCw,
  Settings,
  Sun,
  Users,
  FileText,
} from "lucide-react";
import { ZodError } from "zod";
import { directTasks } from "@/features/tasks/direct-client";
import { directReminders } from "@/features/reminders/direct-client";
import type {
  TaskPriority,
  TaskRecurrenceFrequency,
} from "@/features/tasks/types";
import {
  getMonthGrid,
  getPersianWeekdayLabels,
  formatJalaliDayNumber,
  formatJalaliMonthYear,
  isSameDay,
  shiftJalaliMonth,
} from "@/shared/utils/jalali";
import { MemberFields } from "./schedule-fields";
import { taskEditTime } from "./task-edit-time";
import { toDateTimeLocal } from "@/features/quick-add/payload";
import "./new-task.css";

type Followup = { id: string; due: string; minutes: number };
const idPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function parseFollowup(raw: string | null): Followup | null {
  try {
    const value = JSON.parse(raw ?? "null");
    return value &&
      idPattern.test(value.id) &&
      typeof value.due === "string" &&
      Number.isFinite(Date.parse(value.due)) &&
      [0, 10, 15, 30, 60, 1440].includes(value.minutes)
      ? value
      : null;
  } catch {
    return null;
  }
}
export function NewTask({
  client,
  householdId,
  userId,
  onDone,
  onCancel,
}: {
  client: SupabaseClient;
  householdId: string | null;
  userId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [date, setDate] = useState(""),
    [time, setTime] = useState("12:00"),
    [shared, setShared] = useState(!!householdId),
    [priority, setPriority] = useState<TaskPriority>("NORMAL"),
    [frequency, setFrequency] = useState<TaskRecurrenceFrequency>("NONE"),
    [interval, setInterval] = useState("1"),
    [days, setDays] = useState<number[]>([]),
    [assignees, setAssignees] = useState<string[]>([]),
    [reminder, setReminder] = useState("none");
  const [cursor, setCursor] = useState(() => new Date()),
    [calendarOpen, setCalendarOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [followup, setFollowup] = useState<Followup | null>(null),
    [storageOK, setStorageOK] = useState(true),
    [ready, setReady] = useState(false);
  const key = `khoonemoon:task-reminder-followup:${userId}`;
  useEffect(() => {
    try {
      const saved = parseFollowup(localStorage.getItem(key));
      // Hydrate the durable follow-up after SSR.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setFollowup(saved);
    } catch {
      setStorageOK(false);
    }
    setReady(true);
  }, [key]);
  function persist(item: Followup) {
    setFollowup(item);
    try {
      localStorage.setItem(key, JSON.stringify(item));
    } catch {
      setStorageOK(false);
    }
  }
  function clearFollowup() {
    setFollowup(null);
    try {
      localStorage.removeItem(key);
    } catch {
      setStorageOK(false);
    }
  }
  async function addReminder(item: Followup) {
    await directReminders(client).createTaskReminderOnce({
      targetId: item.id,
      baseDateTime: item.due,
      minutesBefore: item.minutes,
    });
    window.dispatchEvent(new Event("khoonemoon:reminders-changed"));
    clearFollowup();
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !ready) return;
    setBusy(true);
    setMessage("");
    try {
      if (followup) {
        await addReminder(followup);
        window.dispatchEvent(new Event("khoonemoon:schedule-changed"));
        onDone();
        return;
      }
      if (reminder !== "none" && !date)
        throw new Error("برای یادآوری، تاریخ و ساعت سررسید را انتخاب کنید.");
      const dueAt = date
        ? taskEditTime(
            `${date}T${time}`,
            null,
            null,
            Intl.DateTimeFormat().resolvedOptions().timeZone,
          ).dueAt
        : null;
      if (
        reminder !== "none" &&
        dueAt &&
        new Date(dueAt).getTime() - Number(reminder) * 60000 <= Date.now()
      )
        throw new Error(
          "زمان یادآوری گذشته است؛ سررسید یا زمان یادآوری را تغییر دهید.",
        );
      const payload = {
        title,
        description,
        dueAt,
        visibility: shared ? "HOUSEHOLD_SHARED" : "PRIVATE",
        priority,
        status: "PENDING",
        assigneeIds: shared ? assignees : [],
        recurrence: {
          frequency,
          ...(frequency === "INTERVAL_DAYS"
            ? { intervalDays: Number(interval) }
            : {}),
          ...(frequency === "WEEKLY" ? { weekdays: days } : {}),
        },
      };
      const id = await directTasks(client).create(payload);
      window.dispatchEvent(new Event("khoonemoon:schedule-changed"));
      if (reminder !== "none" && dueAt) {
        const item = { id, due: dueAt, minutes: Number(reminder) };
        persist(item);
        try {
          await addReminder(item);
        } catch {
          setMessage(
            "تسک ثبت شد، ولی ثبت یادآوری تأیید نشد. فقط ثبت یادآوری را دوباره امتحان کنید؛ تسک را دوباره نسازید.",
          );
          return;
        }
      }
      onDone();
    } catch (error) {
      setMessage(
        error instanceof ZodError
          ? (error.issues[0]?.message ?? "اطلاعات معتبر نیست.")
          : error instanceof Error
            ? error.message
            : "ثبت تأیید نشد؛ پیش از تلاش دوباره فهرست را بررسی کنید.",
      );
    } finally {
      setBusy(false);
    }
  }
  const chosen = date ? new Date(`${date}T12:00:00`) : null;
  const label =
    chosen && Number.isFinite(chosen.getTime())
      ? new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(chosen)
      : "انتخاب تاریخ";
  function cancel() {
    if (
      followup &&
      !window.confirm(
        "تسک ثبت شده است. بدون تکمیل ثبت یادآوری از صفحه خارج شوید؟ وضعیت یادآوری را در فهرست یادآورها بررسی کنید.",
      )
    )
      return;
    onCancel();
  }
  return (
    <section className="new-task" dir="rtl">
      <header className="new-task-header">
        <button
          type="button"
          aria-label="بازگشت"
          onClick={cancel}
          disabled={busy}
        >
          <ChevronRight />
        </button>
        <div>
          <h1>تسک جدید</h1>
          <p>با هم، خانه‌ای بهتر بسازیم</p>
        </div>
        <span className="new-task-logo" aria-hidden="true" />
      </header>
      {message && (
        <p role="alert" className="new-task-message">
          {message}
        </p>
      )}
      {!storageOK && followup && (
        <p role="alert">
          پیگیری یادآوری در این دستگاه ذخیره نشد؛ تا تعیین وضعیت این صفحه را باز
          نگه دارید.
        </p>
      )}
      {followup && (
        <div className="new-task-pending" role="status">
          <strong>تسک قبلاً ثبت شده است.</strong>
          <p>فقط ثبت یادآوری باقی مانده است؛ تکرار ثبت تسک انجام نمی‌شود.</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  "از تلاش برای ثبت یادآوری صرف‌نظر شود؟ وضعیت آن را در فهرست یادآورها بررسی کنید.",
                )
              ) {
                clearFollowup();
                onDone();
              }
            }}
          >
            بررسی در یادآورها و خروج
          </button>
        </div>
      )}
      <form onSubmit={(e) => void submit(e)}>
        <fieldset
          disabled={busy || !!followup || !ready}
          className="new-task-fields"
        >
          <div className="new-task-card">
            <label>
              <span>
                <Pencil /> عنوان تسک
              </span>
              <input
                required
                minLength={2}
                maxLength={180}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثلاً: خرید مواد غذایی"
              />
            </label>
          </div>
          <div className="new-task-card">
            <label>
              <span>
                <FileText /> توضیحات
              </span>
              <textarea
                maxLength={2000}
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="جزئیات بیشتر را اینجا بنویسید..."
              />
              <small>{description.length.toLocaleString("fa-IR")} / ۲۰۰۰</small>
            </label>
          </div>
          <div className="new-task-card new-task-date-row">
            <div>
              <span className="new-task-label">
                <CalendarDays /> تاریخ سررسید
              </span>
              <button
                type="button"
                className="new-task-date-button"
                aria-expanded={calendarOpen}
                onClick={() => setCalendarOpen(!calendarOpen)}
              >
                {label}
                <CalendarDays />
              </button>
            </div>
            <label>
              <span>
                <Clock3 /> ساعت
              </span>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required={!!date}
              />
            </label>
            {calendarOpen && (
              <div className="new-task-calendar">
                <div>
                  <button
                    type="button"
                    aria-label="ماه قبل"
                    onClick={() => setCursor(shiftJalaliMonth(cursor, -1))}
                  >
                    <ChevronRight />
                  </button>
                  <strong>{formatJalaliMonthYear(cursor)}</strong>
                  <button
                    type="button"
                    aria-label="ماه بعد"
                    onClick={() => setCursor(shiftJalaliMonth(cursor, 1))}
                  >
                    <ChevronLeft />
                  </button>
                </div>
                <div className="new-task-grid">
                  {getPersianWeekdayLabels().map((d, i) => (
                    <span key={i}>{d}</span>
                  ))}
                  {getMonthGrid(cursor).map(({ date: day, isCurrentMonth }) => (
                    <button
                      type="button"
                      key={day.toISOString()}
                      className={isCurrentMonth ? "" : "outside"}
                      aria-pressed={!!chosen && isSameDay(day, chosen)}
                      onClick={() => {
                        setDate(toDateTimeLocal(day).slice(0, 10));
                        setCalendarOpen(false);
                      }}
                    >
                      {formatJalaliDayNumber(day)}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDate("");
                    setCalendarOpen(false);
                  }}
                >
                  بدون سررسید
                </button>
              </div>
            )}
          </div>
          <div className="new-task-card">
            <span className="new-task-label">
              <Flag /> اولویت
            </span>
            <div className="new-task-choices">
              {(
                [
                  ["NORMAL", "عادی"],
                  ["HIGH", "مهم"],
                  ["CRITICAL", "فوری"],
                  ["LOW", "کم"],
                ] as const
              ).map(([id, name]) => (
                <button
                  type="button"
                  key={id}
                  aria-pressed={priority === id}
                  onClick={() => setPriority(id)}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
          <div className="new-task-card">
            <span className="new-task-label">
              <Users /> واگذار به
            </span>
            {shared && householdId ? (
              <MemberFields
                client={client}
                householdId={householdId}
                selected={assignees}
                setSelected={setAssignees}
              />
            ) : (
              <p>تسک خصوصی به خودتان واگذار می‌شود.</p>
            )}
          </div>
          <div className="new-task-card">
            <span className="new-task-label">
              <Eye /> میزان نمایش
            </span>
            <div className="new-task-choices">
              <button
                type="button"
                aria-pressed={!shared}
                onClick={() => {
                  setShared(false);
                  setAssignees([]);
                }}
              >
                <LockKeyhole /> خصوصی
              </button>
              <button
                type="button"
                aria-pressed={shared}
                disabled={!householdId}
                onClick={() => setShared(true)}
              >
                <Users /> مشترک خانه
              </button>
            </div>
            {!householdId && (
              <small>برای اشتراک ابتدا به یک خانه بپیوندید.</small>
            )}
          </div>
          <div className="new-task-card">
            <span className="new-task-label">
              <RefreshCw /> تکرار
            </span>
            <div className="new-task-choices">
              {(
                [
                  ["NONE", "بدون تکرار", Ban],
                  ["DAILY", "روزانه", Sun],
                  ["WEEKLY", "هفتگی", CalendarDays],
                  ["INTERVAL_DAYS", "سفارشی", Settings],
                ] as const
              ).map(([id, name, Icon]) => (
                <button
                  type="button"
                  key={id}
                  aria-pressed={frequency === id}
                  onClick={() => setFrequency(id)}
                >
                  <Icon />
                  {name}
                </button>
              ))}
            </div>
            <label className="new-task-more-repeat">
              گزینه‌های بیشتر
              <select
                value={frequency}
                onChange={(e) =>
                  setFrequency(e.target.value as TaskRecurrenceFrequency)
                }
              >
                <option value="NONE">بدون تکرار</option>
                <option value="DAILY">روزانه</option>
                <option value="WEEKLY">هفتگی</option>
                <option value="INTERVAL_DAYS">هر چند روز</option>
                <option value="MONTHLY">ماهانه</option>
                <option value="YEARLY">سالانه</option>
              </select>
            </label>
            {frequency === "INTERVAL_DAYS" && (
              <label>
                فاصله روزها
                <input
                  type="number"
                  min="1"
                  max="365"
                  required
                  value={interval}
                  onChange={(e) => setInterval(e.target.value)}
                />
              </label>
            )}
            {frequency === "WEEKLY" && (
              <fieldset className="new-task-weekdays">
                <legend>روزهای تکرار هفتگی</legend>
                {[
                  "یکشنبه",
                  "دوشنبه",
                  "سه‌شنبه",
                  "چهارشنبه",
                  "پنجشنبه",
                  "جمعه",
                  "شنبه",
                ].map((name, i) => (
                  <label key={name}>
                    <input
                      type="checkbox"
                      checked={days.includes(i)}
                      onChange={(e) =>
                        setDays(
                          e.target.checked
                            ? [...days, i]
                            : days.filter((d) => d !== i),
                        )
                      }
                    />
                    {name}
                  </label>
                ))}
              </fieldset>
            )}
            {frequency !== "NONE" && (
              <small>تکرار طبق منطقه زمانی دستگاه تنظیم می‌شود.</small>
            )}
          </div>
          <div className="new-task-card">
            <label>
              <span>
                <Bell /> یادآوری
              </span>
              <select
                value={reminder}
                onChange={(e) => setReminder(e.target.value)}
              >
                <option value="none">بدون یادآوری</option>
                <option value="0">در زمان سررسید</option>
                <option value="10">۱۰ دقیقه قبل</option>
                <option value="15">۱۵ دقیقه قبل</option>
                <option value="30">۳۰ دقیقه قبل</option>
                <option value="60">یک ساعت قبل</option>
                <option value="1440">یک روز قبل</option>
              </select>
            </label>
            {frequency !== "NONE" && reminder !== "none" && (
              <small>
                این یادآور فقط برای نوبت نخست ثبت می‌شود؛ برای نوبت‌های بعد باید
                یادآور جدا بسازید.
              </small>
            )}
          </div>
        </fieldset>
        <div className="new-task-submit">
          <button type="submit" disabled={busy || !ready}>
            {busy
              ? "در حال ثبت…"
              : followup
                ? "تلاش دوباره برای یادآوری"
                : "ذخیره تسک"}
          </button>
          <button type="button" disabled={busy} onClick={cancel}>
            لغو
          </button>
        </div>
      </form>
      <footer className="new-task-footer">
        <span aria-hidden="true" />
        <p>خانه، با عشق پیش می‌رود</p>
      </footer>
    </section>
  );
}
