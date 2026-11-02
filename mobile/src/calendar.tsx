import {
  CalendarDays,
  CheckSquare2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  House,
  Leaf,
  Map,
  MapPin,
  Pencil,
  Plus,
  ShoppingCart,
  Soup,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import { directFinance } from "@/features/finance/direct-client";
import type { FinancialRecord } from "@/features/finance/types";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { directCalendar } from "@/features/calendar/direct-client";
import { eventDays } from "@/features/calendar/event-days";
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
  onHouse,
}: {
  client: SupabaseClient;
  householdId: string | null;
  onHouse: () => void;
}) {
  const api = useMemo(() => directCalendar(client), [client]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [chores, setChores] = useState<ChoreRecord[]>([]);
  const [bills, setBills] = useState<FinancialRecord[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
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
  const [calendarError, setCalendarError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadVersion, setLoadVersion] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.all([
      api.list(),
      directTasks(client).list(),
      directFinance(client).list(),
      householdId
        ? directChores(client).list(householdId)
        : Promise.resolve([]),
    ])
      .then(([eventRows, taskRows, financialRows, choreRows]) => {
        if (!active) return;
        setEvents(eventRows);
        setTasks(taskRows);
        setBills(financialRows);
        setChores(choreRows);
        setCalendarError("");
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setEvents([]);
        setTasks([]);
        setBills([]);
        setChores([]);
        setCalendarError(
          "دریافت کامل تقویم ناموفق بود؛ اتصال را بررسی و دوباره تلاش کنید.",
        );
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, client, householdId, loadVersion]);
  useEffect(() => {
    const refresh = () => {
      setLoading(true);
      setLoadVersion((n) => n + 1);
    };
    window.addEventListener("khoonemoon:schedule-changed", refresh);
    return () =>
      window.removeEventListener("khoonemoon:schedule-changed", refresh);
  }, []);

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
    const eventItems = events.flatMap((e) =>
      eventDays(e.start_at, e.end_at, first, end).map((date) => ({
        key: `event-${e.id}-${date.toISOString()}`,
        id: e.id,
        title: e.title,
        date,
        end: new Date(e.end_at),
        kind: "event" as const,
        projected: false,
        location: e.location,
        shared: e.visibility === "HOUSEHOLD_SHARED",
        allDay: e.all_day,
      })),
    );
    const taskItems = tasks
      .filter((t) => t.due_at && t.status !== "ARCHIVED")
      .map((t) => ({
        key: `task-${t.id}`,
        id: t.id,
        title: t.title,
        date: new Date(t.due_at!),
        end: null,
        kind: "task" as const,
        projected: false,
        location: null,
        shared: t.visibility === "HOUSEHOLD_SHARED",
        allDay: false,
      }));
    const choreItems = chores
      .filter((c) => c.is_active && c.next_due_at)
      .flatMap((c) =>
        projectChoreDates(c as CalendarChore, first, end).map(
          ({ due, current }) => ({
            key: `chore-${c.id}-${due.toISOString()}`,
            id: c.id,
            title: c.title,
            date: due,
            end: null,
            kind: "chore" as const,
            projected: !current,
            location: null,
            shared: true,
            allDay: false,
          }),
        ),
      );
    const billItems = bills
      .filter(
        (record) =>
          record.due_at &&
          ["BILL", "SUBSCRIPTION", "INSTALLMENT", "DEBT"].includes(
            record.record_type,
          ),
      )
      .map((record) => ({
        key: `bill-${record.id}`,
        id: record.id,
        title: record.title,
        date: new Date(record.due_at!),
        end: null,
        kind: "bill" as const,
        projected: false,
        location: null,
        shared: record.visibility === "HOUSEHOLD_SHARED",
        allDay: false,
      }));
    return [...eventItems, ...taskItems, ...choreItems, ...billItems]
      .filter((item) => item.date >= first && item.date < end)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [events, tasks, chores, bills, month, selected, view]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (formOpen && !dialog.open) dialog.showModal();
    if (!formOpen && dialog.open) dialog.close();
  }, [formOpen]);
  const toLocalInput = (date: Date) =>
    new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  function openNew() {
    const base = new Date(selected);
    base.setHours(9, 0, 0, 0);
    const finish = new Date(base.getTime() + 60 * 60 * 1000);
    setEditing(null);
    setTitle("");
    setDescription("");
    setLocation("");
    setShared(false);
    setAllDay(false);
    setMessage("");
    setStart(toLocalInput(base));
    setEnd(toLocalInput(finish));
    setFormOpen(true);
  }
  const shownItems =
    view === "month"
      ? calendarItems.filter((item) => isSameDay(item.date, selected))
      : calendarItems;
  const labels = {
    event: "رویداد",
    task: "کار شخصی",
    chore: "کار خانه",
    bill: "قبض و پرداخت",
  } as const;
  const itemIcons = {
    event: CalendarDays,
    task: CheckSquare2,
    chore: House,
    bill: CircleDollarSign,
  } as const;
  const timeLabel = (date: Date) =>
    new Intl.DateTimeFormat("fa-IR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  const navigateMonth = (direction: -1 | 1) => {
    const next = shiftJalaliMonth(cursor, direction);
    setCursor(next);
    setSelected(next);
  };
  const navigateWeek = (direction: -1 | 1) => {
    const next = new Date(selected);
    next.setDate(next.getDate() + direction * 7);
    setSelected(next);
    setCursor(next);
  };

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
        setFormOpen(false);
      } catch {
        setMessage(
          "ثبت رویداد تأیید نشد؛ زمان و اتصال را بررسی کنید و پیش از تلاش دوباره تقویم را تازه کنید.",
        );
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
    setMessage("");
    setFormOpen(true);
  }
  async function remove(id: string) {
    setBusy(true);
    setMessage("");
    try {
      await api.remove(id);
      setEvents((previous) => previous.filter((event) => event.id !== id));
    } catch {
      setMessage(
        "حذف رویداد تأیید نشد؛ پیش از تلاش دوباره تقویم را تازه کنید.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="calendar-page">
      <div className="calendar-hero">
        <div
          className="calendar-botanical calendar-botanical-top"
          aria-hidden="true"
        />
        <button
          className="calendar-house-button"
          type="button"
          onClick={onHouse}
          aria-label="خانه و اعضا"
        >
          <UsersRound size={23} strokeWidth={1.8} aria-hidden="true" />
        </button>
        <h2>تقویم ما</h2>
        <div className="calendar-month-heading">
          <button
            type="button"
            aria-label={view === "week" ? "هفته قبل" : "ماه قبل"}
            disabled={view === "agenda"}
            onClick={() =>
              view === "week" ? navigateWeek(-1) : navigateMonth(-1)
            }
          >
            <ChevronRight size={20} />
          </button>
          <strong>
            {view === "agenda"
              ? "۹۰ روز آینده"
              : view === "week"
                ? formatJalaliLongDate(selected)
                : formatJalaliMonthYear(cursor)}
          </strong>
          <button
            type="button"
            aria-label={view === "week" ? "هفته بعد" : "ماه بعد"}
            disabled={view === "agenda"}
            onClick={() =>
              view === "week" ? navigateWeek(1) : navigateMonth(1)
            }
          >
            <ChevronLeft size={20} />
          </button>
        </div>
      </div>
      <div className="calendar-views" role="group" aria-label="نمای تقویم">
        {(
          [
            ["month", "ماه"],
            ["week", "هفته"],
            ["agenda", "برنامه‌ها"],
          ] as const
        ).map(([id, label]) => (
          <button
            type="button"
            key={id}
            aria-pressed={view === id}
            onClick={() => setView(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {loading && (
        <p role="status" className="calendar-status">
          در حال دریافت اطلاعات تقویم…
        </p>
      )}
      {!formOpen && message && (
        <p role="alert" className="calendar-error">
          {message}
        </p>
      )}
      {calendarError && (
        <div className="calendar-error" role="alert">
          <span>{calendarError}</span>
          <button
            type="button"
            onClick={() => {
              setCalendarError("");
              setLoading(true);
              setLoadVersion((n) => n + 1);
            }}
          >
            تلاش دوباره
          </button>
        </div>
      )}
      {view === "month" && (
        <div className="calendar-month-card">
          <div className="calendar-month-grid">
            {getPersianWeekdayLabels().map((day, index) => (
              <span className="calendar-weekday" key={index}>
                {day}
              </span>
            ))}
            {month.map(({ date, isCurrentMonth }) => {
              const dayKinds = [
                ...new Set(
                  calendarItems
                    .filter((item) => isSameDay(item.date, date))
                    .map((item) => item.kind),
                ),
              ];
              return (
                <button
                  type="button"
                  key={date.toISOString()}
                  aria-label={`${formatJalaliLongDate(date)}${dayKinds.length ? `، ${dayKinds.map((kind) => labels[kind]).join("، ")}` : ""}`}
                  aria-pressed={isSameDay(date, selected)}
                  className={`calendar-cell${isCurrentMonth ? "" : " is-outside"}`}
                  onClick={() => {
                    setSelected(date);
                    setCursor(date);
                  }}
                >
                  <span className="calendar-date-number">
                    {formatJalaliDayNumber(date)}
                  </span>
                  <span className="calendar-dots" aria-hidden="true">
                    {dayKinds.map((kind) => (
                      <i key={kind} className={`calendar-dot is-${kind}`} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="calendar-legend" aria-label="راهنمای نشانگرها">
            {(["chore", "bill", "event", "task"] as const).map((kind) => (
              <span key={kind}>
                <i className={`calendar-dot is-${kind}`} />
                {labels[kind]}
              </span>
            ))}
          </div>
        </div>
      )}
      {view === "week" && (
        <div className="calendar-week-strip">
          {Array.from({ length: 7 }, (_, i) => {
            const date = new Date(selected);
            date.setDate(
              selected.getDate() - ((selected.getDay() + 1) % 7) + i,
            );
            return (
              <button
                type="button"
                key={date.toISOString()}
                aria-pressed={isSameDay(date, selected)}
                onClick={() => {
                  setSelected(date);
                  setCursor(date);
                }}
              >
                <span>{getPersianWeekdayLabels()[i]}</span>
                <strong>{formatJalaliDayNumber(date)}</strong>
              </button>
            );
          })}
        </div>
      )}
      <div className="calendar-day-panel">
        <div className="calendar-day-heading">
          <div>
            <h3>
              {view === "agenda"
                ? "برنامه‌های پیش رو"
                : formatJalaliLongDate(selected)}
            </h3>
            <p>
              <Leaf size={16} aria-hidden="true" />{" "}
              {view === "agenda"
                ? "تا ۹۰ روز آینده"
                : isSameDay(selected, new Date())
                  ? "امروز"
                  : "روز انتخاب‌شده"}
            </p>
          </div>
          <div className="calendar-heading-leaf" aria-hidden="true" />
          <span className="calendar-heading-quote">
            با هم، زندگی زیباتر است.
          </span>
        </div>
        <div className="calendar-day-content">
          <h3>
            {view === "month"
              ? "رویدادهای روز"
              : view === "week"
                ? "برنامه‌های هفته"
                : "برنامه‌ها"}
          </h3>
          {!loading && !calendarError && shownItems.length === 0 && (
            <p className="calendar-empty">
              برای این بازه برنامه‌ای ثبت نشده است.
            </p>
          )}
          <ul className="calendar-agenda-list">
            {shownItems.map((item) => {
              const Icon = /صبحانه|ناهار|شام|غذا|breakfast|lunch|dinner/i.test(
                item.title,
              )
                ? Soup
                : /سفر|مسافرت|trip|travel/i.test(item.title)
                  ? Map
                  : /خرید|shopping/i.test(item.title)
                    ? ShoppingCart
                    : itemIcons[item.kind];
              const event =
                item.kind === "event"
                  ? events.find((e) => e.id === item.id)
                  : undefined;
              return (
                <li
                  className={`calendar-agenda-card is-${item.kind}`}
                  key={item.key}
                >
                  <div className="calendar-agenda-main">
                    <span className="calendar-item-icon">
                      <Icon size={23} strokeWidth={1.6} aria-hidden="true" />
                    </span>
                    <div className="calendar-item-text">
                      <strong>{item.title}</strong>
                      <span>
                        {labels[item.kind]}
                        {item.projected ? " · تخمینی" : ""} ·{" "}
                        {item.shared ? "مشترک" : "شخصی"}
                      </span>
                    </div>
                  </div>
                  <div className="calendar-agenda-meta">
                    <time
                      dir={
                        !item.allDay &&
                        item.end &&
                        (!event ||
                          isSameDay(
                            new Date(event.start_at),
                            new Date(event.end_at),
                          ))
                          ? "ltr"
                          : undefined
                      }
                    >
                      {item.allDay
                        ? "تمام روز"
                        : event &&
                            !isSameDay(
                              new Date(event.start_at),
                              new Date(event.end_at),
                            )
                          ? `${formatJalaliLongDate(new Date(event.start_at))} ${timeLabel(new Date(event.start_at))} تا ${formatJalaliLongDate(new Date(event.end_at))} ${timeLabel(new Date(event.end_at))}`
                          : item.end
                            ? `${timeLabel(item.date)} – ${timeLabel(item.end)}`
                            : timeLabel(item.date)}
                    </time>
                    {view !== "month" && (
                      <small>{formatJalaliLongDate(item.date)}</small>
                    )}
                    {item.location && (
                      <small>
                        <MapPin size={14} aria-hidden="true" />
                        {item.location}
                      </small>
                    )}
                    {event && (
                      <div className="calendar-item-actions">
                        <button
                          type="button"
                          aria-label={`ویرایش ${event.title}`}
                          disabled={busy || loading}
                          onClick={() => edit(event)}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          aria-label={`حذف ${event.title}`}
                          disabled={busy || loading}
                          onClick={() => {
                            if (window.confirm("این رویداد حذف شود؟"))
                              void remove(event.id);
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <button
        type="button"
        className="calendar-refresh"
        disabled={loading || busy}
        onClick={() => {
          setMessage("");
          setCalendarError("");
          setLoading(true);
          setLoadVersion((n) => n + 1);
        }}
      >
        تازه‌سازی تقویم
      </button>
      <p className="calendar-footnote">خانه، جایی برای حالِ خوب</p>
      <button
        type="button"
        className="calendar-add"
        aria-label="افزودن رویداد"
        disabled={busy || loading || !!calendarError}
        onClick={openNew}
      >
        <Plus size={30} strokeWidth={1.7} aria-hidden="true" />
      </button>
      <dialog
        ref={dialogRef}
        className="calendar-form-dialog"
        aria-labelledby="calendar-form-title"
        onClose={() => setFormOpen(false)}
        onCancel={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <div className="calendar-form-heading">
          <h2 id="calendar-form-title">
            {editing ? "ویرایش رویداد" : "ثبت رویداد"}
          </h2>
          <button
            type="button"
            disabled={busy}
            aria-label="بستن"
            onClick={() => setFormOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
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
          <button disabled={busy || loading || !!calendarError}>
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
                setFormOpen(false);
              }}
            >
              انصراف
            </button>
          )}
        </form>
      </dialog>
    </div>
  );
}
