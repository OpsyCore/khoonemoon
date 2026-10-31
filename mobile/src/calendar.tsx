import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { directCalendar } from "@/features/calendar/direct-client";
import { directTasks } from "@/features/tasks/direct-client";
import { directChores } from "@/features/chores/direct-client";
import {
  projectChoreDates,
  type CalendarChore,
} from "@/features/chores/calendar-projection";
import type { TaskRecord } from "@/features/tasks/types";
import type { ChoreRecord } from "@/features/chores/types";
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

/** Calendar views of events, tasks and projected household chores. */
export function CalendarEvents({
  client,
  householdId,
}: {
  client: SupabaseClient;
  householdId: string | null;
}) {
  const api = useMemo(() => directCalendar(client), [client]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [chores, setChores] = useState<ChoreRecord[]>([]);
  const [view, setView] = useState<"month" | "week" | "agenda">("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState(() => new Date());
  const month = useMemo(() => getMonthGrid(cursor), [cursor]);
  const [editing, setEditing] = useState<EventRecord | null>(null);
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

  useEffect(() => {
    let active = true;
    const load = () => {
      void directTasks(client)
        .list()
        .then((rows) => {
          if (active) setTasks(rows);
        })
        .catch(() => {
          if (active) setMessage("دریافت تسک‌های تقویم ناموفق بود.");
        });
      if (householdId)
        void directChores(client)
          .list(householdId)
          .then((rows) => {
            if (active) setChores(rows);
          })
          .catch(() => {
            if (active) setMessage("دریافت کارهای خانه برای تقویم ناموفق بود.");
          });
      else setChores([]);
    };
    load();
    window.addEventListener("khoonemoon:schedule-changed", load);
    return () => {
      active = false;
      window.removeEventListener("khoonemoon:schedule-changed", load);
    };
  }, [client, householdId]);

  const calendarItems = useMemo(() => {
    const first =
      view === "month"
        ? new Date(month[0].date)
        : view === "week"
          ? new Date(selected)
          : new Date();
    if (view === "week")
      first.setDate(first.getDate() - ((first.getDay() + 1) % 7));
    first.setHours(0, 0, 0, 0);
    const end =
      view === "month"
        ? new Date(month[month.length - 1].date)
        : new Date(first);
    end.setDate(
      end.getDate() + (view === "month" ? 1 : view === "week" ? 7 : 90),
    );
    end.setHours(0, 0, 0, 0);
    const eventItems = events.map((e) => ({
      key: `event-${e.id}`,
      title: e.title,
      date: new Date(e.start_at),
      kind: "رویداد",
      projected: false,
    }));
    const taskItems = tasks
      .filter((t) => t.due_at && t.status !== "ARCHIVED")
      .map((t) => ({
        key: `task-${t.id}`,
        title: t.title,
        date: new Date(t.due_at!),
        kind: "تسک",
        projected: false,
      }));
    const choreItems = chores
      .filter((c) => c.is_active && c.next_due_at)
      .flatMap((c) =>
        projectChoreDates(c as CalendarChore, first, end).map(
          ({ due, current }) => ({
            key: `chore-${c.id}-${due.toISOString()}`,
            title: c.title,
            date: due,
            kind: "کار خانه",
            projected: !current,
          }),
        ),
      );
    return [...eventItems, ...taskItems, ...choreItems]
      .filter((item) => item.date >= first && item.date < end)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [events, tasks, chores, month, selected, view]);

  function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    void (async () => {
      try {
        const payload = {
          title,
          startAt: new Date(start).toISOString(),
          endAt: new Date(end).toISOString(),
          description,
          location,
          allDay,
          visibility: shared ? "HOUSEHOLD_SHARED" : "PRIVATE",
        };
        const item = editing
          ? await api.update(editing.id, payload)
          : await api.create(payload);
        setEvents((previous) =>
          [...previous.filter((event) => event.id !== item.id), item].sort(
            (a, b) => a.start_at.localeCompare(b.start_at),
          ),
        );
        setTitle("");
        setStart("");
        setEnd("");
        setLocation("");
        setDescription("");
        setEditing(null);
      } catch {
        setMessage("ثبت رویداد ناموفق بود؛ زمان‌ها و اتصال را بررسی کنید.");
      } finally {
        setBusy(false);
      }
    })();
  }
  function edit(event: EventRecord) {
    const local = (iso: string) => {
      const d = new Date(iso);
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
    };
    setEditing(event);
    setTitle(event.title);
    setStart(local(event.start_at));
    setEnd(local(event.end_at));
    setLocation(event.location || "");
    setDescription(event.description || "");
    setAllDay(event.all_day);
    setShared(event.visibility === "HOUSEHOLD_SHARED");
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
      <p>رویدادها، تسک‌ها و کارهای خانه؛ تکرارهای آینده تخمینی‌اند.</p>
      <div className="month-header" role="group" aria-label="نمای تقویم">
        <button
          className="minor"
          type="button"
          aria-pressed={view === "month"}
          onClick={() => setView("month")}
        >
          ماه
        </button>
        <button
          className="minor"
          type="button"
          aria-pressed={view === "week"}
          onClick={() => setView("week")}
        >
          هفته
        </button>
        <button
          className="minor"
          type="button"
          aria-pressed={view === "agenda"}
          onClick={() => setView("agenda")}
        >
          فهرست
        </button>
      </div>
      {view === "month" && (
        <>
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
                {calendarItems.some((item) => isSameDay(item.date, date)) && (
                  <span aria-hidden="true"> •</span>
                )}
              </button>
            ))}
          </div>
          <p>{formatJalaliLongDate(selected)}</p>
          <ul>
            {calendarItems
              .filter((item) => isSameDay(item.date, selected))
              .map((item) => (
                <li key={item.key}>
                  {item.title} — {item.kind}
                  {item.projected ? " (تخمینی)" : ""}
                </li>
              ))}
          </ul>
        </>
      )}
      {view === "week" && (
        <>
          <div className="month-header">
            <button
              type="button"
              className="minor"
              onClick={() =>
                setSelected((d) => {
                  const next = new Date(d);
                  next.setDate(next.getDate() - 7);
                  return next;
                })
              }
            >
              هفته قبل
            </button>
            <strong>{formatJalaliLongDate(selected)}</strong>
            <button
              type="button"
              className="minor"
              onClick={() =>
                setSelected((d) => {
                  const next = new Date(d);
                  next.setDate(next.getDate() + 7);
                  return next;
                })
              }
            >
              هفته بعد
            </button>
          </div>
        </>
      )}
      {view !== "month" && (
        <ul>
          {calendarItems.map((item) => (
            <li key={item.key}>
              <span>
                {item.title} — {item.kind}
                {item.projected ? " (تخمینی)" : ""}
              </span>
              <time>{formatJalaliLongDate(item.date)}</time>
            </li>
          ))}
        </ul>
      )}
      <h3>{editing ? "ویرایش رویداد" : "ثبت رویداد"}</h3>
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
        {householdId && (
          <label className="item">
            <input
              type="checkbox"
              checked={shared}
              onChange={(e) => setShared(e.target.checked)}
            />
            اشتراک با خانه
          </label>
        )}
        <button disabled={busy}>
          {editing ? "ذخیره تغییرات" : "افزودن رویداد"}
        </button>
        {editing && (
          <button
            type="button"
            className="minor"
            onClick={() => {
              setEditing(null);
              setTitle("");
              setStart("");
              setEnd("");
              setLocation("");
              setDescription("");
            }}
          >
            انصراف
          </button>
        )}
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
              onClick={() => edit(event)}
            >
              ویرایش
            </button>
            <button
              className="minor"
              disabled={busy}
              onClick={() => {
                if (window.confirm("این رویداد حذف شود؟"))
                  void remove(event.id);
              }}
            >
              حذف
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
