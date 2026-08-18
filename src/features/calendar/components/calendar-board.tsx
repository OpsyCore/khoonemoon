"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, List, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ReminderComposer } from "@/features/reminders/components/reminder-composer";
import {
  createEventSchema,
  type CreateEventInput,
} from "@/features/calendar/schemas";
import type { CalendarView, EventRecord } from "@/features/calendar/types";
import type { TaskRecord } from "@/features/tasks/types";
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
  type: "TASK" | "EVENT";
  status?: string;
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
}: {
  tasks: TaskRecord[];
  events: EventRecord[];
  householdId: string | null;
}) {
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());

  const [view, setView] = useState<CalendarView>("month");
  const [cursorDate, setCursorDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
    }));

    return [...taskItems, ...eventItems].sort(
      (a, b) => a.startAt.getTime() - b.startAt.getTime(),
    );
  }, [tasks, events]);

  const monthGrid = useMemo(() => getMonthGrid(cursorDate), [cursorDate]);
  const weekLabels = useMemo(() => getPersianWeekdayLabels(), []);

  const selectedItems = useMemo(
    () => calendarItems.filter((item) => isSameDay(item.startAt, selectedDate)),
    [calendarItems, selectedDate],
  );

  const weekItems = useMemo(() => {
    const start = new Date(selectedDate);
    start.setDate(selectedDate.getDate() - selectedDate.getDay());

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
                const hasItem = calendarItems.some((item) =>
                  isSameDay(item.startAt, day.date),
                );
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
                      <div className="mx-auto mt-1 h-1.5 w-1.5 rounded-full bg-sky-500" />
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
                title="رویدادی در هفته انتخابی نیست"
                description="می‌توانید از فرم پایین، رویداد جدید ثبت کنید."
              />
            ) : (
              <ul className="space-y-2">
                {weekItems.map((item) => (
                  <li
                    key={`${item.type}-${item.id}`}
                    className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-700"
                  >
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {formatJalaliLongDate(item.startAt)} -{" "}
                      {formatPersianTime(item.startAt)}
                    </p>
                    <Badge tone={item.type === "TASK" ? "warning" : "neutral"}>
                      {item.type === "TASK" ? `تسک (${item.status})` : "رویداد"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {view === "agenda" ? (
          <div className="space-y-2">
            {agendaItems.length === 0 ? (
              <EmptyState
                title="آیتم آینده‌ای ندارید"
                description="رویداد یا تسک آینده در فهرست نیست."
              />
            ) : (
              <ul className="space-y-2">
                {agendaItems.map((item) => (
                  <li
                    key={`${item.type}-${item.id}`}
                    className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-700"
                  >
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {formatJalaliLongDate(item.startAt)} -{" "}
                      {formatPersianTime(item.startAt)}
                    </p>
                    <Badge tone={item.type === "TASK" ? "warning" : "neutral"}>
                      {item.type === "TASK" ? "تسک" : "رویداد"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        <CardDescription>
          آیتم‌های روز انتخابی: {selectedItems.length}
        </CardDescription>
      </Card>

      <Card className="space-y-3">
        <CardTitle>{editingEvent ? "ویرایش رویداد" : "رویداد جدید"}</CardTitle>
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
