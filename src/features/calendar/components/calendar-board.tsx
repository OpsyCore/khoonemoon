"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  House,
  ListTodo,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import {
  createEventSchema,
  type CreateEventInput,
} from "@/features/calendar/schemas";
import type { CalendarView, EventRecord } from "@/features/calendar/types";
import {
  addDaysDateOnly,
  buildCalendarChoreItems,
  dateOnlyToLocalDate,
  toDateOnlyLocal,
  type CalendarChoreItem,
  type CalendarChoreSource,
} from "@/features/chores/calendar-items";
import { ReminderComposer } from "@/features/reminders/components/reminder-composer";
import type { TaskRecord } from "@/features/tasks/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardTitle } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { Input } from "@/shared/ui/input";
import { SectionLabel } from "@/shared/ui/section-label";
import {
  formatJalaliDayNumber,
  formatJalaliLongDate,
  formatJalaliMonthYear,
  getMonthGrid,
  getPersianWeekdayLabels,
  isSameDay,
} from "@/shared/utils/jalali";
import { formatPersianTime } from "@/shared/utils/locale";

type CalendarItem = {
  id: string;
  title: string;
  startAt: Date;
  endAt: Date;
  type: "TASK" | "EVENT" | "CHORE";
  status?: string;
  completed?: boolean;
  assignedTo?: string | null;
  choreId?: string;
  forDate?: string;
};

type ChoreMember = { userId: string; fullName: string };

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

function itemBadge(item: CalendarItem) {
  if (item.type === "TASK") {
    return {
      tone: "warning" as const,
      label: item.status ? `تسک (${item.status})` : "تسک",
    };
  }
  if (item.type === "CHORE") {
    return {
      tone: item.completed ? ("success" as const) : ("info" as const),
      label: item.completed ? "کار خانه · انجام شد" : "کار خانه",
    };
  }
  return { tone: "neutral" as const, label: "رویداد" };
}

export function CalendarBoard({
  tasks,
  events,
  chores = [],
  choreMembers = [],
  householdId,
}: {
  tasks: TaskRecord[];
  events: EventRecord[];
  chores?: CalendarChoreSource[];
  choreMembers?: ChoreMember[];
  householdId: string | null;
}) {
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());

  const [view, setView] = useState<CalendarView>("month");
  const [cursorDate, setCursorDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<EventRecord | null>(null);
  const [completingKey, setCompletingKey] = useState<string | null>(null);
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

  const startAtValue = useWatch({ control, name: "startAt" });
  const endAtValue = useWatch({ control, name: "endAt" });

  const memberName = useMemo(() => {
    const map = new Map(choreMembers.map((m) => [m.userId, m.fullName]));
    return (id: string | null | undefined) => {
      if (!id) return "—";
      return map.get(id) ?? "کاربر";
    };
  }, [choreMembers]);

  /** Wide enough for month nav ±1 and agenda */
  const choreWindow = useMemo(() => {
    const base = new Date(cursorDate);
    const from = new Date(base.getFullYear(), base.getMonth() - 1, 1);
    const to = new Date(base.getFullYear(), base.getMonth() + 2, 0);
    // agenda needs a bit of future from "today"
    const today = new Date();
    const agendaTo = new Date(today);
    agendaTo.setDate(today.getDate() + 60);
    const fromStr =
      from.getTime() < today.getTime() - 40 * 86400000
        ? toDateOnlyLocal(from)
        : toDateOnlyLocal(
            new Date(
              today.getFullYear(),
              today.getMonth(),
              today.getDate() - 40,
            ),
          );
    const toCandidate = to.getTime() > agendaTo.getTime() ? to : agendaTo;
    return {
      fromDate: fromStr,
      toDate: toDateOnlyLocal(toCandidate),
    };
  }, [cursorDate]);

  const choreOccurrences = useMemo(
    () =>
      buildCalendarChoreItems(chores, choreWindow.fromDate, choreWindow.toDate),
    [chores, choreWindow.fromDate, choreWindow.toDate],
  );

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
    }));

    const choreItems: CalendarItem[] = choreOccurrences.map((item) => {
      const start = dateOnlyToLocalDate(item.forDate);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      return {
        id: `${item.choreId}:${item.forDate}`,
        title: item.title,
        startAt: start,
        endAt: end,
        type: "CHORE",
        completed: item.completed,
        assignedTo: item.assignedTo,
        choreId: item.choreId,
        forDate: item.forDate,
      };
    });

    return [...taskItems, ...eventItems, ...choreItems].sort(
      (a, b) => a.startAt.getTime() - b.startAt.getTime(),
    );
  }, [tasks, events, choreOccurrences]);

  const monthGrid = useMemo(() => getMonthGrid(cursorDate), [cursorDate]);
  const weekLabels = useMemo(() => getPersianWeekdayLabels(), []);

  const selectedItems = useMemo(
    () => calendarItems.filter((item) => isSameDay(item.startAt, selectedDate)),
    [calendarItems, selectedDate],
  );

  const selectedChores = useMemo(
    () => selectedItems.filter((item) => item.type === "CHORE"),
    [selectedItems],
  );

  const weekItems = useMemo(() => {
    const start = new Date(selectedDate);
    start.setDate(selectedDate.getDate() - selectedDate.getDay());
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 7);

    return calendarItems.filter(
      (item) =>
        item.startAt.getTime() >= start.getTime() &&
        item.startAt.getTime() < end.getTime(),
    );
  }, [calendarItems, selectedDate]);

  const agendaItems = calendarItems.filter(
    (item) =>
      item.startAt.getTime() >= new Date().getTime() - 24 * 60 * 60 * 1000,
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
        { event: "*", schema: "public", table: "chore_completions" },
        () => router.refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, router, householdId]);

  const onSubmit = async (values: CreateEventInput) => {
    setErrorMessage(null);

    const response = await fetch(
      editingEvent ? `/api/events/${editingEvent.id}` : "/api/events",
      {
        method: editingEvent ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      },
    );

    const result = (await response.json().catch(() => ({}))) as {
      message?: string;
    };

    if (!response.ok) {
      setErrorMessage(result.message ?? "ذخیره رویداد ناموفق بود.");
      return;
    }

    setEditingEvent(null);
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
    setValue("title", event.title);
    setValue("description", event.description ?? "");
    setValue("visibility", event.visibility);
    setValue("startAt", event.start_at);
    setValue("endAt", event.end_at);
    setValue("allDay", event.all_day);
    setValue("location", event.location ?? "");
  };

  const deleteEvent = async (id: string) => {
    const response = await fetch(`/api/events/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      setErrorMessage("حذف رویداد ناموفق بود.");
      return;
    }

    router.refresh();
  };

  const completeChore = async (item: CalendarItem) => {
    if (!item.choreId || !item.forDate) return;
    const key = `${item.choreId}:${item.forDate}`;
    setCompletingKey(key);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/chores/${item.choreId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forDate: item.forDate }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "ثبت انجام کار ناموفق بود.");
      }
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "ثبت انجام کار ناموفق بود.",
      );
    } finally {
      setCompletingKey(null);
    }
  };

  function renderItemRow(item: CalendarItem) {
    const badge = itemBadge(item);
    const choreKey =
      item.choreId && item.forDate ? `${item.choreId}:${item.forDate}` : null;
    const busy = choreKey !== null && completingKey === choreKey;

    return (
      <li
        key={`${item.type}-${item.id}`}
        className="flex items-start gap-3 px-4 py-3.5"
      >
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
            item.type === "CHORE"
              ? "bg-clay-soft text-clay-ink"
              : item.type === "TASK"
                ? "bg-sunken text-ink-soft"
                : "bg-olive-soft text-olive-ink"
          }`}
        >
          {item.type === "CHORE" ? (
            <House className="size-4" strokeWidth={1.6} />
          ) : item.type === "TASK" ? (
            <ListTodo className="size-4" strokeWidth={1.6} />
          ) : (
            <CalendarDays className="size-4" strokeWidth={1.6} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">{item.title}</p>
          <p className="mt-0.5 text-[11px] text-muted">
            {formatJalaliLongDate(item.startAt)}
            {item.type !== "CHORE" ? (
              <>
                {" — "}
                {formatPersianTime(item.startAt)}
              </>
            ) : (
              <> · مسئول: {memberName(item.assignedTo)}</>
            )}
          </p>
          <div className="mt-1.5">
            <Badge tone={badge.tone}>{badge.label}</Badge>
          </div>
        </div>
        {item.type === "CHORE" && !item.completed ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void completeChore(item)}
            className="mt-0.5 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-olive px-3.5 text-[12px] font-medium text-cream transition hover:bg-olive-deep disabled:opacity-60 dark:text-[#221c14]"
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="size-3.5" strokeWidth={2} />
            )}
            انجام شد
          </button>
        ) : null}
      </li>
    );
  }

  const viewTabs: { key: CalendarView; label: string }[] = [
    { key: "month", label: "ماه" },
    { key: "week", label: "هفته" },
    { key: "agenda", label: "فهرست" },
  ];

  return (
    <div className="space-y-7">
      {/* paper planner */}
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-ink">
            {formatJalaliMonthYear(cursorDate)}
          </h2>
          <div className="flex rounded-full bg-sunken p-1">
            {viewTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setView(tab.key)}
                className={`rounded-full px-3.5 py-1.5 text-[12px] font-medium transition ${
                  view === tab.key
                    ? "bg-card text-ink shadow-paper"
                    : "text-muted hover:text-ink"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label="ماه قبل"
            onClick={() => {
              const date = new Date(cursorDate);
              date.setMonth(cursorDate.getMonth() - 1);
              setCursorDate(date);
            }}
            className="inline-flex size-9 items-center justify-center rounded-full border border-line-strong bg-paper text-ink-soft transition hover:bg-sunken"
          >
            <ChevronRight className="size-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={() => {
              const date = new Date();
              setCursorDate(date);
              setSelectedDate(date);
            }}
            className="inline-flex h-9 items-center rounded-full border border-line-strong bg-paper px-4 text-[13px] font-medium text-ink transition hover:bg-sunken"
          >
            امروز
          </button>
          <button
            type="button"
            aria-label="ماه بعد"
            onClick={() => {
              const date = new Date(cursorDate);
              date.setMonth(cursorDate.getMonth() + 1);
              setCursorDate(date);
            }}
            className="inline-flex size-9 items-center justify-center rounded-full border border-line-strong bg-paper text-ink-soft transition hover:bg-sunken"
          >
            <ChevronLeft className="size-4" strokeWidth={1.75} />
          </button>
        </div>

        {view === "month" ? (
          <div className="space-y-1.5">
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted">
              {weekLabels.map((label) => (
                <div key={label} className="py-1">
                  {label}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {monthGrid.map((day) => {
                const dayItems = calendarItems.filter((item) =>
                  isSameDay(item.startAt, day.date),
                );
                const hasEvent = dayItems.some((item) => item.type !== "CHORE");
                const hasChore = dayItems.some((item) => item.type === "CHORE");
                const selected = isSameDay(day.date, selectedDate);
                const isToday = isSameDay(day.date, new Date());

                return (
                  <button
                    key={day.date.toISOString()}
                    type="button"
                    onClick={() => setSelectedDate(day.date)}
                    className={`flex aspect-square flex-col items-center justify-center rounded-field text-sm transition ${
                      selected
                        ? "bg-olive font-semibold text-cream shadow-paper dark:text-[#221c14]"
                        : isToday
                          ? "bg-olive-soft font-semibold text-olive-ink"
                          : day.isCurrentMonth
                            ? "text-ink hover:bg-sunken"
                            : "text-faint hover:bg-sunken"
                    }`}
                  >
                    <span>{formatJalaliDayNumber(day.date)}</span>
                    <span className="mt-0.5 flex h-1.5 items-center justify-center gap-0.5">
                      {hasEvent ? (
                        <span
                          className={`size-1.5 rounded-full ${
                            selected ? "bg-cream/90" : "bg-olive"
                          }`}
                        />
                      ) : null}
                      {hasChore ? (
                        <span
                          className={`size-1.5 rounded-full ${
                            selected ? "bg-cream/60" : "bg-clay"
                          }`}
                        />
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {view === "week" ? (
          <div className="space-y-2">
            <p className="text-sm text-ink-soft">
              {formatJalaliLongDate(selectedDate)}
            </p>
            {weekItems.length === 0 ? (
              <p className="rounded-field border border-dashed border-line-strong/70 px-4 py-4 text-center text-[13px] text-muted">
                رویداد، تسک یا کار خانه‌ای در این هفته نیست.
              </p>
            ) : (
              <ul className="divide-y divide-line rounded-card border border-line bg-paper/50">
                {weekItems.map(renderItemRow)}
              </ul>
            )}
          </div>
        ) : null}

        {view === "agenda" ? (
          <div className="space-y-2">
            {agendaItems.length === 0 ? (
              <p className="rounded-field border border-dashed border-line-strong/70 px-4 py-4 text-center text-[13px] text-muted">
                رویداد، تسک یا کار خانهٔ آینده‌ای در فهرست نیست.
              </p>
            ) : (
              <ul className="divide-y divide-line rounded-card border border-line bg-paper/50">
                {agendaItems.map(renderItemRow)}
              </ul>
            )}
          </div>
        ) : null}

        {view === "month" ? (
          <div className="space-y-2 border-t border-line pt-4">
            <p className="text-[13px] font-semibold text-ink-soft">
              {formatJalaliLongDate(selectedDate)}
              <span className="mr-2 font-normal text-muted">
                · {selectedItems.length} آیتم
                {selectedChores.length > 0
                  ? ` · کار خانه: ${selectedChores.length}`
                  : ""}
              </span>
            </p>
            {selectedItems.length > 0 ? (
              <ul className="divide-y divide-line rounded-card border border-line bg-paper/50">
                {selectedItems.map(renderItemRow)}
              </ul>
            ) : (
              <p className="text-xs text-muted">
                برای این روز رویداد، تسک یا کار خانه‌ای نیست.
              </p>
            )}
          </div>
        ) : null}
      </Card>

      {errorMessage ? (
        <p className="rounded-field border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger-ink">
          {errorMessage}
        </p>
      ) : null}

      <div className="space-y-3">
        <SectionLabel>ثبت رویداد</SectionLabel>
        <Card id="quick-add-event" className="space-y-4 p-5">
          <CardTitle>
            {editingEvent ? "ویرایش رویداد" : "رویداد جدید"}
          </CardTitle>
          <form
            className="space-y-3.5"
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

            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-ink-soft">
                  حریم خصوصی
                </label>
                <select
                  className="h-11 w-full rounded-field border border-line-strong bg-paper px-3 text-sm text-ink outline-none transition focus:border-olive focus:ring-2 focus:ring-olive/25"
                  {...register("visibility")}
                >
                  <option value="PRIVATE">خصوصی</option>
                  <option value="HOUSEHOLD_SHARED" disabled={!householdId}>
                    اشتراکی خانه
                  </option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-7">
                <input
                  id="allDay"
                  type="checkbox"
                  className="size-4 accent-[#9AA06E]"
                  {...register("allDay")}
                />
                <label htmlFor="allDay" className="text-sm text-ink-soft">
                  تمام روز
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
              <Input
                label="شروع"
                type="datetime-local"
                value={toDateTimeLocal(startAtValue)}
                onChange={(event) =>
                  setValue("startAt", fromDateTimeLocal(event.target.value))
                }
                error={errors.startAt?.message}
              />
              <Input
                label="پایان"
                type="datetime-local"
                value={toDateTimeLocal(endAtValue)}
                onChange={(event) =>
                  setValue("endAt", fromDateTimeLocal(event.target.value))
                }
                error={errors.endAt?.message}
              />
            </div>

            <Input
              label="محل"
              error={errors.location?.message}
              {...register("location")}
            />

            <div className="flex gap-2 pt-1">
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
      </div>

      <div className="space-y-3">
        <SectionLabel>رویدادهای ثبت‌شده</SectionLabel>
        {events.length === 0 ? (
          <EmptyState
            title="رویدادی ثبت نشده"
            description="اولین رویداد مشترک‌تان را از فرم بالا اضافه کنید."
          />
        ) : (
          <ul className="divide-y divide-line rounded-card border border-line bg-card shadow-paper">
            {events.map((event) => (
              <li key={event.id} className="space-y-2 px-4 py-3.5">
                <div className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block size-2 shrink-0 rounded-full bg-olive" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">
                      {event.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {formatJalaliLongDate(new Date(event.start_at))} —{" "}
                      {formatPersianTime(new Date(event.start_at))}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => editEvent(event)}
                      aria-label="ویرایش"
                      className="inline-flex size-7 items-center justify-center rounded-full text-muted transition hover:bg-sunken hover:text-ink"
                    >
                      <Pencil className="size-3.5" strokeWidth={1.75} />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteEvent(event.id)}
                      aria-label="حذف"
                      className="inline-flex size-7 items-center justify-center rounded-full text-muted transition hover:bg-danger-soft hover:text-danger-ink"
                    >
                      <Trash2 className="size-3.5" strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
                <div className="pr-5">
                  <ReminderComposer
                    targetType="EVENT"
                    targetId={event.id}
                    baseDateTime={event.start_at}
                    householdId={event.household_id}
                    onCreated={() => router.refresh()}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
