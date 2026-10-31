import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { directCalendar } from "@/features/calendar/direct-client";
import type { EventRecord } from "@/features/calendar/types";
import {
  formatJalaliDayNumber,
  formatJalaliLongDate,
  formatJalaliMonthYear,
  getMonthGrid,
  getPersianWeekdayLabels,
  isSameDay,
  shiftJalaliMonth,
} from "@/shared/utils/jalali";

/** Month view currently includes events only; tasks and chores are still being integrated. */
export function CalendarEvents({
  client,
  hasHousehold,
}: {
  client: SupabaseClient;
  hasHousehold: boolean;
}) {
  const api = useMemo(() => directCalendar(client), [client]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState(() => new Date());
  const month = useMemo(() => getMonthGrid(cursor), [cursor]);
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [location, setLocation] = useState("");
  const [shared, setShared] = useState(false);
  const [allDay, setAllDay] = useState(false);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void api
      .list()
      .then((rows) => {
        if (active) setEvents(rows);
      })
      .catch(() => {
        if (active) setMessage("دریافت رویدادها ناموفق بود.");
      });
    return () => {
      active = false;
    };
  }, [api]);

  function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    void (async () => {
      try {
        const item = await api.create({
          title,
          startAt: new Date(start).toISOString(),
          endAt: new Date(end).toISOString(),
          description,
          location,
          allDay,
          visibility: shared ? "HOUSEHOLD_SHARED" : "PRIVATE",
        });
        setEvents((previous) =>
          [...previous, item].sort((a, b) =>
            a.start_at.localeCompare(b.start_at),
          ),
        );
        setTitle("");
        setStart("");
        setEnd("");
        setLocation("");
        setDescription("");
      } catch {
        setMessage("ثبت رویداد ناموفق بود؛ زمان‌ها و اتصال را بررسی کنید.");
      } finally {
        setBusy(false);
      }
    })();
  }
  async function remove(id: string) {
    setBusy(true);
    setMessage("");
    try {
      await api.remove(id);
      setEvents((previous) => previous.filter((event) => event.id !== id));
    } catch {
      setMessage("حذف رویداد ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h2>تقویم</h2>
      <p>
        نمای ماه در حال حاضر رویدادها را نشان می‌دهد؛ نمایش تسک‌ها و کارهای خانه
        هنوز منتقل نشده است.
      </p>
      <div className="month-header">
        <button
          type="button"
          className="minor"
          onClick={() => setCursor((date) => shiftJalaliMonth(date, -1))}
        >
          ماه قبل
        </button>
        <strong>{formatJalaliMonthYear(cursor)}</strong>
        <button
          type="button"
          className="minor"
          onClick={() => setCursor((date) => shiftJalaliMonth(date, 1))}
        >
          ماه بعد
        </button>
      </div>
      <div className="calendar-grid">
        {getPersianWeekdayLabels().map((day, index) => (
          <span className="weekday" key={index}>
            {day}
          </span>
        ))}
        {month.map(({ date, isCurrentMonth }) => (
          <button
            type="button"
            key={date.toISOString()}
            aria-label={formatJalaliLongDate(date)}
            aria-pressed={isSameDay(date, selected)}
            className={`calendar-day${isCurrentMonth ? "" : " outside"}`}
            onClick={() => setSelected(date)}
          >
            {formatJalaliDayNumber(date)}
            {events.some((e) => isSameDay(new Date(e.start_at), date)) && (
              <span aria-hidden="true"> •</span>
            )}
          </button>
        ))}
      </div>
      <p>{formatJalaliLongDate(selected)}</p>
      <ul>
        {events
          .filter((event) => isSameDay(new Date(event.start_at), selected))
          .map((event) => (
            <li key={event.id}>{event.title}</li>
          ))}
      </ul>
      <h3>ثبت رویداد</h3>
      {message && (
        <p role="alert" className="error">
          {message}
        </p>
      )}
      <form onSubmit={create}>
        <label>
          عنوان
          <input
            required
            minLength={2}
            maxLength={180}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          توضیحات
          <input
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label>
          شروع
          <input
            type="datetime-local"
            required
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label>
          پایان
          <input
            type="datetime-local"
            required
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        <label>
          محل
          <input
            maxLength={300}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </label>
        <label className="item">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
          />
          تمام روز
        </label>
        {hasHousehold && (
          <label className="item">
            <input
              type="checkbox"
              checked={shared}
              onChange={(e) => setShared(e.target.checked)}
            />
            اشتراک با خانه
          </label>
        )}
        <button disabled={busy}>افزودن رویداد</button>
      </form>
      <ul>
        {events.map((event) => (
          <li key={event.id}>
            <div>
              <strong>{event.title}</strong>
              <p>
                {new Intl.DateTimeFormat("fa-IR", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(event.start_at))}
              </p>
            </div>
            <button
              className="minor"
              disabled={busy}
              onClick={() => void remove(event.id)}
            >
              حذف
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
