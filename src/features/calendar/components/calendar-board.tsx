"use client";

import { directChores } from "@/features/chores/direct-client";
import { directCalendar } from "@/features/calendar/direct-client";

import {
  projectChoreDates,
  type CalendarChore,
} from "@/features/chores/calendar-projection";
import { zodResolver } from "@hookform/resolvers/zod";
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
import Link from "next/link";
import { eventOverlaps } from "@/features/calendar/event-days";
import type { FinancialRecord } from "@/features/finance/types";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ReminderComposer } from "@/features/reminders/components/reminder-composer";
import {
  createEventSchema,
  type CreateEventInput,
} from "@/features/calendar/schemas";
import type { CalendarView, EventRecord } from "@/features/calendar/types";
import type { TaskRecord } from "@/features/tasks/types";
import { Button } from "@/shared/ui/button";
import { Card, CardTitle } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { Input } from "@/shared/ui/input";
import {
  formatJalaliDayNumber,
  formatJalaliLongDate,
  formatJalaliMonthYear,
  getMonthGrid,
  getPersianWeekdayLabels,
  isSameDay,
  shiftJalaliMonth,
} from "@/shared/utils/jalali";
import { formatPersianTime } from "@/shared/utils/locale";

type CalendarItem = {
  id: string;
  title: string;
  startAt: Date;
  endAt: Date;
  type: "TASK" | "EVENT" | "CHORE" | "BILL";
  location?: string | null;
  allDay?: boolean;
  status?: string;
  projected?: boolean;
};

function toDateTimeLocal(iso: string) {
  const date = new Date(iso);
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}

function fromDateTimeLocal(value: string) {
  return new Date(value).toISOString();
}

function buildDefaultEventTimes() {
  const start = new Date();
  const end = new Date(start);
  end.setHours(end.getHours() + 1);

  return {
    startAt: start.toISOString(),
    endAt: end.toISOString(),
  };
}

export function CalendarBoard({
  tasks,
  events,
  householdId,
  chores,
  choresLoadError,
  bills,
  billsLoadError,
}: {
  tasks: TaskRecord[];
  events: EventRecord[];
  householdId: string | null;
  chores: CalendarChore[];
  choresLoadError: boolean;
  bills: FinancialRecord[];
  billsLoadError: boolean;
}) {
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());

  const [view, setView] = useState<CalendarView>("month");
  const [cursorDate, setCursorDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completingChore, setCompletingChore] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const formDialog = useRef<HTMLDialogElement>(null);
  const [editingEvent, setEditingEvent] = useState<EventRecord | null>(null);
  const [defaultEventTimes] = useState(() => buildDefaultEventTimes());

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CreateEventInput>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      title: "",
      description: "",
      visibility: householdId ? "HOUSEHOLD_SHARED" : "PRIVATE",
      startAt: defaultEventTimes.startAt,
      endAt: defaultEventTimes.endAt,
      allDay: false,
      location: "",
    },
  });

  useEffect(() => {
    const dialog = formDialog.current;
    if (!dialog) return;
    if (formOpen && !dialog.open) dialog.showModal();
    if (!formOpen && dialog.open) dialog.close();
  }, [formOpen]);

  const startAtValue = useWatch({ control, name: "startAt" });
  const endAtValue = useWatch({ control, name: "endAt" });

  const calendarItems = useMemo<CalendarItem[]>(() => {
    const taskItems: CalendarItem[] = tasks
      .filter((task) => Boolean(task.due_at))
      .map((task) => {
        const start = new Date(task.due_at as string);
        const end = new Date(start.getTime() + 60 * 60 * 1000);

        return {
          id: task.id,
          title: task.title,
          startAt: start,
          endAt: end,
          type: "TASK",
          status: task.status,
        };
      });

    const eventItems: CalendarItem[] = events.map((event) => ({
      id: event.id,
      title: event.title,
      startAt: new Date(event.start_at),
      endAt: new Date(event.end_at),
      type: "EVENT",
      location: event.location,
      allDay: event.all_day,
    }));
    const billItems: CalendarItem[] = bills
      .filter(
        (bill) =>
          bill.due_at &&
          ["BILL", "SUBSCRIPTION", "INSTALLMENT", "DEBT"].includes(
            bill.record_type,
          ),
      )
      .map((bill) => ({
        id: bill.id,
        title: bill.title,
        startAt: new Date(bill.due_at!),
        endAt: new Date(bill.due_at!),
        type: "BILL",
      }));

    // Limit projected occurrences to the displayed month/week, or 90 days in
    // agenda. Future dates are estimates, never additional completed records.
    const grid = getMonthGrid(cursorDate);
    const from =
      view === "month"
        ? new Date(grid[0].date)
        : view === "week"
          ? new Date(selectedDate)
          : new Date();
    if (view === "week")
      from.setDate(from.getDate() - ((from.getDay() + 1) % 7));
    if (view === "agenda") from.setDate(from.getDate() - 1);
    from.setHours(0, 0, 0, 0);
    const to =
      view === "month" ? new Date(grid[grid.length - 1].date) : new Date(from);
    if (view === "month") to.setDate(to.getDate() + 1);
    else to.setDate(to.getDate() + (view === "week" ? 7 : 91));
    to.setHours(0, 0, 0, 0);
    const choreItems: CalendarItem[] = chores.flatMap((chore) =>
      projectChoreDates(chore, from, to).map(({ due, current }) => ({
        id: chore.id,
        title: chore.title,
        startAt: due,
        endAt: due,
        type: "CHORE" as const,
        projected: !current,
      })),
    );
    return [...taskItems, ...eventItems, ...choreItems, ...billItems].sort(
      (a, b) => a.startAt.getTime() - b.startAt.getTime(),
    );
  }, [tasks, events, chores, bills, cursorDate, selectedDate, view]);

  const monthGrid = useMemo(() => getMonthGrid(cursorDate), [cursorDate]);
  const weekLabels = useMemo(() => getPersianWeekdayLabels(), []);

  const occursOn = (item: CalendarItem, day: Date) => {
    if (item.type !== "EVENT") return isSameDay(item.startAt, day);
    const from = new Date(day);
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    return eventOverlaps(
      item.startAt.toISOString(),
      item.endAt.toISOString(),
      from,
      to,
    );
  };
  const selectedItems = useMemo(
    () => calendarItems.filter((item) => occursOn(item, selectedDate)),
    [calendarItems, selectedDate],
  );

  const weekItems = useMemo(() => {
    const start = new Date(selectedDate);
    start.setDate(selectedDate.getDate() - ((selectedDate.getDay() + 1) % 7));
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 7);

    return calendarItems.filter((item) =>
      item.type === "EVENT"
        ? eventOverlaps(
            item.startAt.toISOString(),
            item.endAt.toISOString(),
            start,
            end,
          )
        : item.startAt.getTime() >= start.getTime() &&
          item.startAt.getTime() < end.getTime(),
    );
  }, [calendarItems, selectedDate]);

  const agendaStart = new Date();
  agendaStart.setHours(0, 0, 0, 0);
  const agendaEnd = new Date(agendaStart);
  agendaEnd.setDate(agendaEnd.getDate() + 90);
  const agendaItems = calendarItems.filter((item) =>
    item.type === "EVENT"
      ? eventOverlaps(
          item.startAt.toISOString(),
          item.endAt.toISOString(),
          agendaStart,
          agendaEnd,
        )
      : item.startAt >= agendaStart && item.startAt < agendaEnd,
  );

  useEffect(() => {
    const channel = supabase
      .channel(`calendar-live-${householdId ?? "private"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chores" },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "financial_records" },
        () => router.refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, router, householdId]);

  const onSubmit = async (values: CreateEventInput) => {
    setErrorMessage(null);

    try {
      if (editingEvent) {
        const response = await fetch(`/api/events/${editingEvent.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
        if (!response.ok)
          throw new Error("ویرایش رویداد تأیید نشد؛ فهرست را تازه کنید.");
      } else {
        await directCalendar(supabase).create(values);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "ذخیره رویداد تأیید نشد.",
      );
      return;
    }

    setEditingEvent(null);
    setFormOpen(false);
    const freshTimes = buildDefaultEventTimes();
    reset({
      title: "",
      description: "",
      visibility: householdId ? "HOUSEHOLD_SHARED" : "PRIVATE",
      startAt: freshTimes.startAt,
      endAt: freshTimes.endAt,
      allDay: false,
      location: "",
    });

    router.refresh();
  };

  const editEvent = (event: EventRecord) => {
    setEditingEvent(event);
    setFormOpen(true);
    setValue("title", event.title);
    setValue("description", event.description ?? "");
    setValue("visibility", event.visibility);
    setValue("startAt", event.start_at);
    setValue("endAt", event.end_at);
    setValue("allDay", event.all_day);
    setValue("location", event.location ?? "");
  };

  const deleteEvent = async (id: string) => {
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/events/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("delete failed");
      router.refresh();
    } catch {
      setErrorMessage(
        "حذف رویداد تأیید نشد؛ پیش از تلاش دوباره تقویم را تازه کنید.",
      );
    }
  };

  const completeChore = async (id: string) => {
    if (completingChore) return;
    setCompletingChore(id);
    try {
      const revision = chores.find(
        (item) => item.id === id,
      )?.completion_revision;
      if (typeof revision !== "number") throw new Error("missing revision");
      await directChores(supabase).completeVersion(id, revision);
      setErrorMessage(null);
      router.refresh();
    } catch {
      setErrorMessage(
        "نتیجهٔ ثبت انجام مشخص نیست یا کار تغییر کرده؛ فهرست را تازه کنید.",
      );
    } finally {
      setCompletingChore(null);
    }
  };

  const itemType = (item: CalendarItem) =>
    item.type === "BILL"
      ? "قبض و پرداخت"
      : item.type === "TASK"
        ? "کار شخصی"
        : item.type === "CHORE"
          ? item.projected
            ? "کار خانه · پیش‌بینی"
            : "کار خانه"
          : "رویداد";
  const choreButton = (item: CalendarItem) =>
    item.type === "CHORE" && !item.projected ? (
      <Button
        size="sm"
        variant="soft"
        disabled={completingChore !== null}
        isLoading={completingChore === item.id}
        onClick={() => void completeChore(item.id)}
      >
        ثبت انجام
      </Button>
    ) : null;

  const showForm = () => {
    const start = new Date(selectedDate);
    start.setHours(9, 0, 0, 0);
    const end = new Date(start.getTime() + 3600000);
    setEditingEvent(null);
    setErrorMessage(null);
    reset({
      title: "",
      description: "",
      visibility: householdId ? "HOUSEHOLD_SHARED" : "PRIVATE",
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      allDay: false,
      location: "",
    });
    setFormOpen(true);
  };
  const move = (direction: -1 | 1) => {
    const next =
      view === "week"
        ? new Date(selectedDate)
        : shiftJalaliMonth(cursorDate, direction);
    if (view === "week") next.setDate(next.getDate() + 7 * direction);
    setCursorDate(next);
    setSelectedDate(next);
  };
  const iconFor = {
    EVENT: CalendarDays,
    TASK: CheckSquare2,
    CHORE: House,
    BILL: CircleDollarSign,
  };
  const shownItems =
    view === "month"
      ? selectedItems
      : view === "week"
        ? weekItems
        : agendaItems;
  return (
    <div className="web-calendar-board">
      <div className="web-calendar-hero">
        <Link
          href="/home"
          className="web-calendar-house"
          aria-label="خانه و اعضا"
        >
          <UsersRound size={24} aria-hidden="true" />
        </Link>
        <h1>تقویم ما</h1>
        <div className="web-calendar-heading-nav">
          <button
            type="button"
            aria-label={view === "week" ? "هفته قبل" : "ماه قبل"}
            disabled={view === "agenda"}
            onClick={() => move(-1)}
          >
            <ChevronRight size={20} />
          </button>
          <strong>
            {view === "agenda"
              ? "۹۰ روز آینده"
              : view === "week"
                ? formatJalaliLongDate(selectedDate)
                : formatJalaliMonthYear(cursorDate)}
          </strong>
          <button
            type="button"
            aria-label={view === "week" ? "هفته بعد" : "ماه بعد"}
            disabled={view === "agenda"}
            onClick={() => move(1)}
          >
            <ChevronLeft size={20} />
          </button>
        </div>
      </div>
      <div className="web-calendar-views" role="group" aria-label="نمای تقویم">
        {(
          [
            ["month", "ماه"],
            ["week", "هفته"],
            ["agenda", "برنامه‌ها"],
          ] as const
        ).map(([value, label]) => (
          <button
            type="button"
            key={value}
            aria-pressed={view === value}
            onClick={() => setView(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {errorMessage && (
        <p role="alert" className="text-sm text-danger-ink">
          {errorMessage}
        </p>
      )}
      {choresLoadError && (
        <p role="alert" className="text-sm text-danger-ink">
          دریافت کارهای خانه برای تقویم ناموفق بود.
        </p>
      )}
      {billsLoadError && (
        <p role="alert" className="text-sm text-danger-ink">
          دریافت قبض‌ها و پرداخت‌ها برای تقویم ناموفق بود.
        </p>
      )}
      {view === "month" && (
        <Card className="web-calendar-month">
          <div className="web-calendar-grid">
            {weekLabels.map((label, index) => (
              <div className="web-calendar-weekday" key={index}>
                {label}
              </div>
            ))}
            {monthGrid.map((day) => {
              const kinds = [
                ...new Set(
                  calendarItems
                    .filter((item) => occursOn(item, day.date))
                    .map((item) => item.type),
                ),
              ];
              const selected = isSameDay(day.date, selectedDate);
              return (
                <button
                  key={day.date.toISOString()}
                  type="button"
                  aria-label={formatJalaliLongDate(day.date)}
                  aria-pressed={selected}
                  className={`web-calendar-cell${day.isCurrentMonth ? "" : " outside"}`}
                  onClick={() => {
                    setSelectedDate(day.date);
                    setCursorDate(day.date);
                  }}
                >
                  <span className="web-calendar-date">
                    {formatJalaliDayNumber(day.date)}
                  </span>
                  <span className="web-calendar-dots" aria-hidden="true">
                    {kinds.map((kind) => (
                      <i
                        key={kind}
                        className={`web-calendar-dot type-${kind.toLowerCase()}`}
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="web-calendar-legend">
            {(
              [
                ["chore", "کار خانه"],
                ["bill", "قبض و پرداخت"],
                ["event", "رویداد"],
                ["task", "کار شخصی"],
              ] as const
            ).map(([kind, label]) => (
              <span key={kind}>
                <i className={`web-calendar-dot type-${kind}`} />
                {label}
              </span>
            ))}
          </div>
        </Card>
      )}
      {view === "week" && (
        <div className="web-calendar-week-strip">
          {weekLabels.map((label, i) => {
            const date = new Date(selectedDate);
            date.setDate(date.getDate() - ((date.getDay() + 1) % 7) + i);
            return (
              <button
                type="button"
                key={i}
                aria-pressed={isSameDay(date, selectedDate)}
                onClick={() => {
                  setSelectedDate(date);
                  setCursorDate(date);
                }}
              >
                <span>{label}</span>
                <strong>{formatJalaliDayNumber(date)}</strong>
              </button>
            );
          })}
        </div>
      )}
      <div className="web-calendar-day-panel">
        <div className="web-calendar-day-heading">
          <div>
            <h2>
              {view === "agenda"
                ? "برنامه‌های پیش رو"
                : formatJalaliLongDate(selectedDate)}
            </h2>
            <p>
              <Leaf size={15} aria-hidden="true" />
              {view === "agenda"
                ? "تا ۹۰ روز آینده"
                : isSameDay(selectedDate, new Date())
                  ? "امروز"
                  : "روز انتخاب‌شده"}
            </p>
          </div>
          <span>با هم، زندگی زیباتر است.</span>
        </div>
        <div className="web-calendar-day-content">
          <h3>
            {view === "month"
              ? "رویدادهای روز"
              : view === "week"
                ? "برنامه‌های هفته"
                : "برنامه‌ها"}
          </h3>
          {shownItems.length === 0 && (
            <p className="web-calendar-empty">
              {billsLoadError || choresLoadError
                ? "بخشی از اطلاعات دریافت نشد."
                : "برای این بازه برنامه‌ای ثبت نشده است."}
            </p>
          )}
          <ul className="web-calendar-items">
            {shownItems.map((item) => {
              const Icon = /صبحانه|ناهار|شام|غذا|breakfast|lunch|dinner/i.test(
                item.title,
              )
                ? Soup
                : /سفر|مسافرت|trip|travel/i.test(item.title)
                  ? Map
                  : /خرید|shopping/i.test(item.title)
                    ? ShoppingCart
                    : iconFor[item.type];
              const event =
                item.type === "EVENT"
                  ? events.find((e) => e.id === item.id)
                  : undefined;
              return (
                <li
                  key={`${item.type}-${item.id}-${item.startAt.toISOString()}`}
                  className={`web-calendar-item type-${item.type.toLowerCase()}`}
                >
                  <div className="web-calendar-item-main">
                    <span className="web-calendar-icon">
                      <Icon size={23} aria-hidden="true" />
                    </span>
                    <div>
                      <strong>{item.title}</strong>
                      <p>{itemType(item)}</p>
                    </div>
                  </div>
                  <div className="web-calendar-item-meta">
                    <time
                      dir={
                        !item.allDay &&
                        item.type === "EVENT" &&
                        isSameDay(item.startAt, item.endAt)
                          ? "ltr"
                          : undefined
                      }
                    >
                      {item.allDay
                        ? "تمام روز"
                        : item.type === "EVENT"
                          ? isSameDay(item.startAt, item.endAt)
                            ? `${formatPersianTime(item.startAt)} – ${formatPersianTime(item.endAt)}`
                            : `${formatJalaliLongDate(item.startAt)} ${formatPersianTime(item.startAt)} تا ${formatJalaliLongDate(item.endAt)} ${formatPersianTime(item.endAt)}`
                          : formatPersianTime(item.startAt)}
                    </time>
                    {view !== "month" && (
                      <small>{formatJalaliLongDate(item.startAt)}</small>
                    )}
                    {item.location && (
                      <small>
                        <MapPin size={14} />
                        {item.location}
                      </small>
                    )}
                    {choreButton(item)}
                    {event && (
                      <div className="web-calendar-actions">
                        <button
                          type="button"
                          aria-label={`ویرایش ${event.title}`}
                          onClick={() => editEvent(event)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          aria-label={`حذف ${event.title}`}
                          onClick={() => {
                            if (window.confirm("این رویداد حذف شود؟"))
                              void deleteEvent(event.id);
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                        <ReminderComposer
                          targetType="EVENT"
                          targetId={event.id}
                          baseDateTime={event.start_at}
                          householdId={event.household_id}
                          onCreated={() => router.refresh()}
                        />
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="web-calendar-projection-note">
            تکرارهای آینده کارهای خانه پیش‌بینی‌اند؛ ثبت انجام فقط برای سررسید
            بعدی ممکن است.
          </p>
        </div>
      </div>
      <p className="web-calendar-footer">خانه، جایی برای حالِ خوب</p>
      <button
        type="button"
        className="web-calendar-add"
        aria-label="افزودن رویداد"
        onClick={showForm}
      >
        <Plus size={30} aria-hidden="true" />
      </button>
      <dialog
        ref={formDialog}
        id="web-calendar-event-form"
        className="web-calendar-form-wrap"
        aria-label={editingEvent ? "ویرایش رویداد" : "رویداد جدید"}
        onClose={() => setFormOpen(false)}
        onCancel={(event) => {
          if (isSubmitting) event.preventDefault();
        }}
      >
        <Card className="space-y-3">
          <div className="web-calendar-form-header">
            <CardTitle>
              {editingEvent ? "ویرایش رویداد" : "رویداد جدید"}
            </CardTitle>
            <button
              type="button"
              aria-label="بستن فرم"
              disabled={isSubmitting}
              onClick={() => setFormOpen(false)}
            >
              <X size={20} />
            </button>
          </div>
          <form
            className="space-y-3"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
          >
            <Input
              label="عنوان"
              error={errors.title?.message}
              {...register("title")}
            />

            <Input
              label="توضیحات"
              error={errors.description?.message}
              {...register("description")}
            />

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-ink">
                  حریم خصوصی
                </label>
                <select
                  className="h-11 w-full rounded-2xl border border-line-strong bg-paper px-3 text-sm text-ink"
                  {...register("visibility")}
                >
                  <option value="PRIVATE">خصوصی</option>
                  <option value="HOUSEHOLD_SHARED" disabled={!householdId}>
                    اشتراکی خانه
                  </option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-7">
                <input id="allDay" type="checkbox" {...register("allDay")} />
                <label htmlFor="allDay" className="text-sm text-ink-soft">
                  تمام روز
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input
                label="شروع"
                type="datetime-local"
                value={toDateTimeLocal(startAtValue)}
                onChange={(event) => {
                  if (event.target.value)
                    setValue("startAt", fromDateTimeLocal(event.target.value));
                }}
                error={errors.startAt?.message}
              />
              <Input
                label="پایان"
                type="datetime-local"
                value={toDateTimeLocal(endAtValue)}
                onChange={(event) => {
                  if (event.target.value)
                    setValue("endAt", fromDateTimeLocal(event.target.value));
                }}
                error={errors.endAt?.message}
              />
            </div>

            <Input
              label="محل"
              error={errors.location?.message}
              {...register("location")}
            />

            {errorMessage ? (
              <p className="text-sm text-rose-600 dark:text-rose-400">
                {errorMessage}
              </p>
            ) : null}

            <div className="flex gap-2">
              <Button type="submit" isLoading={isSubmitting} className="flex-1">
                {editingEvent ? "ذخیره رویداد" : "افزودن رویداد"}
              </Button>
              {editingEvent ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEditingEvent(null);
                    reset();
                  }}
                >
                  انصراف
                </Button>
              ) : null}
            </div>
          </form>
        </Card>
      </dialog>
      <details className="web-calendar-all-events">
        <summary>همه رویدادهای ثبت‌شده</summary>
        <Card className="space-y-2">
          <CardTitle>رویدادهای ثبت‌شده</CardTitle>
          {events.length === 0 ? (
            <EmptyState
              title="رویدادی ثبت نشده"
              description="اولین رویداد را از فرم بالا اضافه کنید."
            />
          ) : (
            <ul className="space-y-2">
              {events.map((event) => (
                <li
                  key={event.id}
                  className="rounded-2xl border border-line p-3"
                >
                  <p className="text-sm font-semibold">{event.title}</p>
                  <p className="text-xs text-muted">
                    {formatJalaliLongDate(new Date(event.start_at))} -{" "}
                    {formatPersianTime(new Date(event.start_at))}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => editEvent(event)}
                    >
                      ویرایش
                    </Button>

                    <ReminderComposer
                      targetType="EVENT"
                      targetId={event.id}
                      baseDateTime={event.start_at}
                      householdId={event.household_id}
                      onCreated={() => router.refresh()}
                    />

                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => deleteEvent(event.id)}
                    >
                      <Trash2 className="size-4" />
                      حذف
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </details>
    </div>
  );
}
