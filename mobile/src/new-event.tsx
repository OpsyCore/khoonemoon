import { useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  LockKeyhole,
  MapPin,
  Pencil,
  Users,
} from "lucide-react";
import { ZodError } from "zod";
import { directCalendar } from "@/features/calendar/direct-client";
import { directReminders } from "@/features/reminders/direct-client";
import {
  formatJalaliDayNumber,
  formatJalaliMonthYear,
  getMonthGrid,
  getPersianWeekdayLabels,
  isSameDay,
  shiftJalaliMonth,
} from "@/shared/utils/jalali";
import { toDateTimeLocal } from "@/features/quick-add/payload";
import { taskEditTime } from "./task-edit-time";
import "./new-task.css";
import "./new-event.css";

type Followup = { id: string; due: string; minutes: number };
export function parseEventFollowup(raw: string | null): Followup | null {
  try {
    const x = JSON.parse(raw ?? "null");
    return x &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        x.id,
      ) &&
      typeof x.due === "string" &&
      Number.isFinite(Date.parse(x.due)) &&
      [0, 10, 15, 30, 60, 1440].includes(x.minutes)
      ? x
      : null;
  } catch {
    return null;
  }
}
/** All-day ranges use local midnights and an exclusive end, even across DST. */
export function eventTimes(
  startDate: string,
  endDate: string,
  startTime: string,
  endTime: string,
  allDay: boolean,
) {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const start = taskEditTime(
    `${startDate}T${allDay ? "00:00" : startTime}`,
    null,
    null,
    zone,
  ).dueAt;
  let endInput = `${endDate}T${allDay ? "00:00" : endTime}`;
  if (allDay) {
    const endDay = new Date(`${endDate}T12:00:00`);
    if (
      !Number.isFinite(endDay.getTime()) ||
      toDateTimeLocal(endDay).slice(0, 10) !== endDate
    )
      throw new Error("تاریخ پایان معتبر نیست.");
    endDay.setDate(endDay.getDate() + 1);
    endInput = `${toDateTimeLocal(endDay).slice(0, 10)}T00:00`;
  }
  const end = taskEditTime(endInput, null, null, zone).dueAt;
  if (
    !start ||
    !end ||
    (allDay && endDate < startDate) ||
    new Date(end).getTime() <= new Date(start).getTime()
  )
    throw new Error("زمان پایان باید پس از شروع باشد.");
  return { startAt: start, endAt: end };
}
function PersianDateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const chosen = new Date(`${value}T12:00:00`);
  const [cursor, setCursor] = useState(() =>
    Number.isFinite(chosen.getTime()) ? chosen : new Date(),
  );
  const [open, setOpen] = useState(false);
  return (
    <div className="event-date">
      <span className="event-label">
        {label} <b>*</b>
      </span>
      <button
        type="button"
        className="event-input event-date-button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <CalendarDays />
        {Number.isFinite(chosen.getTime())
          ? new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }).format(chosen)
          : "انتخاب تاریخ"}
      </button>
      {open && (
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
            {getMonthGrid(cursor).map(({ date, isCurrentMonth }) => (
              <button
                type="button"
                key={date.toISOString()}
                className={isCurrentMonth ? "" : "outside"}
                aria-pressed={isSameDay(date, chosen)}
                onClick={() => {
                  onChange(toDateTimeLocal(date).slice(0, 10));
                  setOpen(false);
                }}
              >
                {formatJalaliDayNumber(date)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
export function NewEvent({
  client,
  userId,
  householdId,
  onDone,
  onCancel,
  initialDate,
}: {
  client: SupabaseClient;
  userId: string;
  householdId: string | null;
  onDone: () => void;
  onCancel: () => void;
  initialDate?: Date;
}) {
  const [date] = useState(() =>
    toDateTimeLocal(initialDate ?? new Date()).slice(0, 10),
  );
  const [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [startDate, setStartDate] = useState(date),
    [endDate, setEndDate] = useState(date),
    [startTime, setStartTime] = useState("09:00"),
    [endTime, setEndTime] = useState("10:00"),
    [allDay, setAllDay] = useState(false),
    [location, setLocation] = useState(""),
    [shared, setShared] = useState(!!householdId),
    [reminder, setReminder] = useState("none");
  const [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [message, setMessage] = useState(""),
    [followup, setFollowup] = useState<Followup | null>(null),
    [storageOK, setStorageOK] = useState(true);
  const key = `khoonemoon:event-reminder-followup:${userId}`;
  useEffect(() => {
    try {
      const item = parseEventFollowup(localStorage.getItem(key));
      // Hydrate the account-scoped follow-up after SSR.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (item) setFollowup(item);
    } catch {
      setStorageOK(false);
    }
    setReady(true);
  }, [key]);
  function persist(item: Followup) {
    setFollowup(item);
    try {
      localStorage.setItem(key, JSON.stringify(item));
      if (!localStorage.getItem(key)) throw new Error();
    } catch {
      setStorageOK(false);
      throw new Error(
        "ذخیره پیگیری روی دستگاه ممکن نیست؛ این صفحه را باز نگه دارید.",
      );
    }
  }
  function clear() {
    setFollowup(null);
    try {
      localStorage.removeItem(key);
    } catch {
      setStorageOK(false);
    }
  }
  async function addReminder(item: Followup) {
    await directReminders(client).createEventReminderOnce({
      targetId: item.id,
      baseDateTime: item.due,
      minutesBefore: item.minutes,
    });
    window.dispatchEvent(new Event("khoonemoon:reminders-changed"));
    clear();
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !ready) return;
    setBusy(true);
    setMessage("");
    try {
      if (followup) {
        await addReminder(followup);
        onDone();
        return;
      }
      const times = eventTimes(startDate, endDate, startTime, endTime, allDay);
      if (
        reminder !== "none" &&
        new Date(times.startAt).getTime() - Number(reminder) * 60000 <=
          Date.now()
      )
        throw new Error(
          "زمان یادآوری گذشته است؛ زمان رویداد یا یادآوری را تغییر دهید.",
        );
      const item = await directCalendar(client).create(
        {
          title,
          description,
          location,
          visibility: shared ? "HOUSEHOLD_SHARED" : "PRIVATE",
          ...times,
          allDay,
        },
        reminder !== "none"
          ? (row) =>
              persist({
                id: row.id,
                due: times.startAt,
                minutes: Number(reminder),
              })
          : undefined,
      );
      window.dispatchEvent(new Event("khoonemoon:schedule-changed"));
      if (reminder !== "none") {
        try {
          await addReminder({
            id: item.id,
            due: times.startAt,
            minutes: Number(reminder),
          });
        } catch {
          setMessage(
            "رویداد ثبت شد ولی ثبت یادآوری تأیید نشد؛ فقط ثبت یادآوری را دوباره امتحان کنید.",
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
            : "ثبت تأیید نشد؛ پیش از تلاش دوباره تقویم را بررسی کنید.",
      );
    } finally {
      setBusy(false);
    }
  }
  function cancel() {
    if (
      followup &&
      !window.confirm("رویداد ثبت شده است. بدون تکمیل ثبت یادآوری خارج شوید؟")
    )
      return;
    onCancel();
  }
  return (
    <section className="new-task new-event" dir="rtl">
      <header className="event-header">
        <button
          type="button"
          onClick={cancel}
          aria-label="بازگشت"
          disabled={busy}
        >
          <ChevronRight />
        </button>
        <h1>رویداد جدید</h1>
      </header>
      <div className="event-intro">
        <p>
          برای زندگی مشترکمان،
          <br /> رویدادهای قشنگ بسازیم.
        </p>
        <p>
          لحظه‌های خوب
          <br /> با هم ماندگار می‌شوند ... <span>♥</span>
        </p>
        <span className="event-art" aria-hidden="true" />
      </div>
      {message && (
        <p className="new-task-message" role="alert">
          {message}
        </p>
      )}
      {!storageOK && (
        <p role="alert">
          ذخیره پیگیری روی این دستگاه ممکن نیست؛ تا تعیین وضعیت این صفحه را باز
          نگه دارید.
        </p>
      )}
      {followup && (
        <div className="new-task-pending" role="status">
          <strong>رویداد قبلاً ثبت شده است.</strong>
          <p>فقط ثبت یادآوری باقی مانده است؛ رویداد دوباره ساخته نمی‌شود.</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  "از تلاش برای ثبت یادآوری صرف‌نظر شود؟ وضعیت آن را در یادآورها بررسی کنید.",
                )
              ) {
                clear();
                onDone();
              }
            }}
          >
            بررسی در یادآورها و خروج
          </button>
        </div>
      )}
      <form onSubmit={(e) => void submit(e)} className="event-form">
        <fieldset
          disabled={busy || !!followup || !ready}
          className="event-fields"
        >
          <label>
            <span className="event-label">
              عنوان رویداد <b>*</b>
            </span>
            <div className="event-control">
              <Pencil />
              <input
                required
                minLength={2}
                maxLength={180}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثلاً: سالگرد آشنایی"
              />
            </div>
          </label>
          <label>
            <span className="event-label">توضیحات</span>
            <div className="event-control event-textarea">
              <FileText />
              <textarea
                maxLength={2000}
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="جزئیات رویداد را بنویسید ..."
              />
            </div>
          </label>
          <div className="event-pair">
            <PersianDateField
              label="تاریخ شروع (شمسی)"
              value={startDate}
              onChange={setStartDate}
            />
            <PersianDateField
              label="تاریخ پایان (شمسی)"
              value={endDate}
              onChange={setEndDate}
            />
          </div>
          <div className="event-pair">
            <label>
              <span className="event-label">ساعت شروع</span>
              <div className="event-control">
                <Clock3 />
                <input
                  type="time"
                  required={!allDay}
                  disabled={allDay}
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
            </label>
            <label>
              <span className="event-label">ساعت پایان</span>
              <div className="event-control">
                <Clock3 />
                <input
                  type="time"
                  required={!allDay}
                  disabled={allDay}
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </label>
          </div>
          <label className="event-all-day">
            <span>این رویداد تمام روز است.</span>
            <strong>تمام روز</strong>
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
            />
          </label>
          <label>
            <span className="event-label">مکان</span>
            <div className="event-control">
              <MapPin />
              <input
                maxLength={300}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="مثلاً: کافه لمیز، تهران"
              />
            </div>
          </label>
          <div>
            <span className="event-label">میزان نمایش</span>
            <div className="event-pair event-choice">
              <button
                type="button"
                aria-pressed={shared}
                disabled={!householdId}
                onClick={() => setShared(true)}
              >
                <Users />
                <span>
                  مشترک<small>برای هر دو نفر</small>
                </span>
              </button>
              <button
                type="button"
                aria-pressed={!shared}
                onClick={() => setShared(false)}
              >
                <LockKeyhole />
                <span>
                  خصوصی<small>فقط برای من</small>
                </span>
              </button>
            </div>
            {!householdId && (
              <small>برای اشتراک ابتدا به یک خانه بپیوندید.</small>
            )}
          </div>
          <label>
            <span className="event-label">یادآوری</span>
            <div className="event-control">
              <Bell />
              <select
                value={reminder}
                onChange={(e) => setReminder(e.target.value)}
              >
                <option value="none">بدون یادآوری</option>
                <option value="0">در زمان شروع</option>
                <option value="10">۱۰ دقیقه قبل</option>
                <option value="15">۱۵ دقیقه قبل</option>
                <option value="30">۳۰ دقیقه قبل</option>
                <option value="60">یک ساعت قبل</option>
                <option value="1440">یک روز قبل</option>
              </select>
            </div>
          </label>
        </fieldset>
        <button
          className="event-submit"
          type="submit"
          disabled={busy || !ready}
        >
          {busy
            ? "در حال ثبت…"
            : followup
              ? "تلاش دوباره برای یادآوری"
              : "ذخیره رویداد"}{" "}
          <CalendarDays />
        </button>
      </form>
    </section>
  );
}
