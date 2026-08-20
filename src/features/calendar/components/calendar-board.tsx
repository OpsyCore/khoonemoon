"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  CalendarDays,
  CheckCircle2,
  List,
  Loader2,
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
import { Card, CardDescription, CardTitle } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { Input } from "@/shared/ui/input";
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
            new Date(today.getFullYear(), today.getMonth(), today.getDate() - 40),
          );
    const toCandidate = to.getTime() > agendaTo.getTime() ? to : agendaTo;
    return {
      fromDate: fromStr,
      toDate: toDateOnlyLocal(toCandidate),
    };
  }, [cursorDate]);

  const choreOccurrences = useMemo(
    () =>
      buildCalendarChoreItems(
        chores,
        choreWindow.fromDate,
        choreWindow.toDate,
      ),
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
    () =>
      calendarItems.filter((item) => isSameDay(item.startAt, selectedDate)),
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
      item.choreId && item.forDate
        ? `${item.choreId}:${item.forDate}`
        : null;
    const busy = choreKey !== null && completingKey === choreKey;

    return (
      <li
        key={`${item.type}-${item.id}`}
        className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-700"
      >
        <p className="text-sm font-medium">{item.title}</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {formatJalaliLongDate(item.startAt)}
          {item.type !== "CHORE" ? (
            <>
              {" - "}
              {formatPersianTime(item.startAt)}
            </>
          ) : (
            <> · مسئول: {memberName(item.assignedTo)}</>
          )}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge tone={badge.tone}>{badge.label}</Badge>
          {item.type === "CHORE" && !item.completed ? (
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void completeChore(item)}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              انجام شد
            </Button>
          ) : null}
        </div>
      </li>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <CardTitle>{formatJalaliMonthYear(cursorDate)}</CardTitle>
          <div className="flex gap-2">
            <Button
              variant={view === "month" ? "primary" : "ghost"}
              size="sm"
              onClick={() => setView("month")}
            >
              <CalendarDays className="size-4" />
              ماه
            </Button>
            <Button
              variant={view === "week" ? "primary" : "ghost"}
              size="sm"
              onClick={() => setView("week")}
            >
              هفته
            </Button>
            <Button
              variant={view === "agenda" ? "primary" : "ghost"}
              size="sm"
              onClick={() => setView("agenda")}
            >
              <List className="size-4" />
              فهرست
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const date = new Date(cursorDate);
              date.setMonth(cursorDate.getMonth() - 1);
              setCursorDate(date);
            }}
          >
            ماه قبل
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const date = new Date();
              setCursorDate(date);
              setSelectedDate(date);
            }}
          >
            امروز
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const date = new Date(cursorDate);
              date.setMonth(cursorDate.getMonth() + 1);
              setCursorDate(date);
            }}
          >
            ماه بعد
          </Button>
        </div>

        {view === "month" ? (
          <div className="space-y-2">
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-zinc-500 dark:text-zinc-400">
              {weekLabels.map((label) => (
                <div key={label}>{label}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {monthGrid.map((day) => {
                const dayItems = calendarItems.filter((item) =>
                  isSameDay(item.startAt, day.date),
                );
                const hasItem = dayItems.length > 0;
                const hasChore = dayItems.some((item) => item.type === "CHORE");
                const selected = isSameDay(day.date, selectedDate);

                return (
                  <button
                    key={day.date.toISOString()}
                    type="button"
                    className={`rounded-xl border p-2 text-center text-sm transition ${
                      selected
                        ? "border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
                        : "border-zinc-200 dark:border-zinc-700"
                    } ${
                      day.isCurrentMonth
                        ? "text-zinc-900 dark:text-zinc-100"
                        : "text-zinc-400 dark:text-zinc-600"
                    }`}
                    onClick={() => setSelectedDate(day.date)}
                  >
                    <div>{formatJalaliDayNumber(day.date)}</div>
                    {hasItem ? (
                      <div className="mt-1 flex items-center justify-center gap-0.5">
                        <div
                          className={`h-1.5 w-1.5 rounded-full ${
                            hasChore ? "bg-emerald-500" : "bg-sky-500"
                          }`}
                        />
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {view === "week" ? (
          <div className="space-y-2">
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              {formatJalaliLongDate(selectedDate)}
            </p>
            {weekItems.length === 0 ? (
              <EmptyState
                title="آیتمی در هفته انتخابی نیست"
                description="رویداد، تسک یا کار خانه در این هفته نیست."
              />
            ) : (
              <ul className="space-y-2">{weekItems.map(renderItemRow)}</ul>
            )}
          </div>
        ) : null}

        {view === "agenda" ? (
          <div className="space-y-2">
            {agendaItems.length === 0 ? (
              <EmptyState
                title="آیتم آینده‌ای ندارید"
                description="رویداد، تسک یا کار خانهٔ آینده در فهرست نیست."
              />
            ) : (
              <ul className="space-y-2">{agendaItems.map(renderItemRow)}</ul>
            )}
          </div>
        ) : null}

        <CardDescription>
          آیتم‌های روز انتخابی: {selectedItems.length}
          {selectedChores.length > 0
            ? ` · کار خانه: ${selectedChores.length}`
            : ""}
        </CardDescription>

        {view === "month" && selectedItems.length > 0 ? (
          <ul className="space-y-2">{selectedItems.map(renderItemRow)}</ul>
        ) : null}
        {view === "month" && selectedItems.length === 0 ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            برای این روز رویداد، تسک یا کار خانه‌ای نیست.
          </p>
        ) : null}
      </Card>

      {errorMessage ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          {errorMessage}
        </p>
      ) : null}

      <Card className="space-y-3">
        <CardTitle>
          {editingEvent ? "ویرایش رویداد" : "رویداد جدید"}
        </CardTitle>
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
              <label className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                حریم خصوصی
              </label>
              <select
                className="h-11 w-full rounded-2xl border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
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
              <label
                htmlFor="allDay"
                className="text-sm text-zinc-700 dark:text-zinc-200"
              >
                تمام روز
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
                className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-700"
              >
                <p className="text-sm font-semibold">{event.title}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
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
    </div>
  );
}
