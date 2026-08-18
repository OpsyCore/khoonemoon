"use client";

import {
  AlarmClockCheck,
  CalendarClock,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { EventRecord } from "@/features/calendar/types";
import type { TaskRecord } from "@/features/tasks/types";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardDescription, CardTitle } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { Input } from "@/shared/ui/input";
import { formatJalaliLongDate } from "@/shared/utils/jalali";
import { formatPersianTime } from "@/shared/utils/locale";

function toDateTimeLocal(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}

function fromDateTimeLocal(value: string) {
  if (!value) return null;
  return new Date(value).toISOString();
}

export function TodayDashboard({
  tasks,
  events,
}: {
  tasks: TaskRecord[];
  events: EventRecord[];
}) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rescheduleTaskId, setRescheduleTaskId] = useState<string | null>(null);
  const [rescheduleValue, setRescheduleValue] = useState("");

  const derived = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);

    const overdueTasks = tasks.filter(
      (task) =>
        task.status !== "COMPLETED" &&
        task.due_at &&
        new Date(task.due_at).getTime() < startOfToday.getTime(),
    );

    const todayTasks = tasks.filter(
      (task) =>
        task.due_at &&
        new Date(task.due_at).getTime() >= startOfToday.getTime() &&
        new Date(task.due_at).getTime() < endOfToday.getTime(),
    );

    const upcomingEvents = events.filter(
      (event) =>
        new Date(event.start_at).getTime() >= now.getTime() &&
        new Date(event.start_at).getTime() <
          now.getTime() + 7 * 24 * 60 * 60 * 1000,
    );

    return { overdueTasks, todayTasks, upcomingEvents };
  }, [tasks, events]);

  const completeToggle = async (task: TaskRecord) => {
    setErrorMessage(null);

    const response = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: task.status === "COMPLETED" ? "undo" : "complete",
      }),
    });

    if (!response.ok) {
      setErrorMessage("بروزرسانی وضعیت تسک ناموفق بود.");
      return;
    }

    router.refresh();
  };

  const reschedule = async () => {
    if (!rescheduleTaskId || !rescheduleValue) {
      setErrorMessage("زمان جدید را انتخاب کنید.");
      return;
    }

    setErrorMessage(null);

    const response = await fetch(`/api/tasks/${rescheduleTaskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reschedule",
        dueAt: fromDateTimeLocal(rescheduleValue),
      }),
    });

    if (!response.ok) {
      setErrorMessage("زمان‌بندی مجدد ناموفق بود.");
      return;
    }

    setRescheduleTaskId(null);
    setRescheduleValue("");
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-2">
        <CardTitle>{formatJalaliLongDate(new Date())}</CardTitle>
        <CardDescription>
          تمرکز امروز: کارهای ضروری، معوق و رویدادهای پیش‌رو
        </CardDescription>
      </Card>

      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3 text-center">
          <p className="text-lg font-semibold">{derived.todayTasks.length}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">امروز</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-lg font-semibold">{derived.overdueTasks.length}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">معوق</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-lg font-semibold">
            {derived.upcomingEvents.length}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            رویداد آینده
          </p>
        </Card>
      </div>

      <Card className="space-y-3">
        <CardTitle>کارهای معوق</CardTitle>
        {derived.overdueTasks.length === 0 ? (
          <EmptyState
            title="مورد معوقی ندارید"
            description="عالیه! همه چیز سر وقت پیش می‌رود."
          />
        ) : (
          <ul className="space-y-2">
            {derived.overdueTasks.map((task) => (
              <li
                key={task.id}
                className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-700"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{task.title}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      موعد:{" "}
                      {task.due_at
                        ? formatJalaliLongDate(new Date(task.due_at))
                        : "نامشخص"}
                    </p>
                  </div>
                  <Badge tone="danger">معوق</Badge>
                </div>

                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => completeToggle(task)}
                  >
                    <CheckCircle2 className="size-4" />
                    تکمیل
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setRescheduleTaskId(task.id);
                      setRescheduleValue(toDateTimeLocal(task.due_at));
                    }}
                  >
                    <RotateCcw className="size-4" />
                    زمان‌بندی مجدد
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-3">
        <CardTitle>آیتم‌های امروز</CardTitle>
        {derived.todayTasks.length === 0 ? (
          <EmptyState
            title="تسک امروز ندارید"
            description="برای امروز تسکی ثبت نشده است."
          />
        ) : (
          <ul className="space-y-2">
            {derived.todayTasks.map((task) => (
              <li
                key={task.id}
                className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-700"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold">{task.title}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {task.due_at
                        ? formatPersianTime(new Date(task.due_at))
                        : "بدون زمان"}
                    </p>
                  </div>
                  <Badge
                    tone={task.status === "COMPLETED" ? "success" : "neutral"}
                  >
                    {task.status}
                  </Badge>
                </div>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => completeToggle(task)}
                  >
                    {task.status === "COMPLETED" ? (
                      <>
                        <AlarmClockCheck className="size-4" />
                        بازگردانی
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="size-4" />
                        تکمیل
                      </>
                    )}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-3">
        <CardTitle>رویدادهای آینده نزدیک</CardTitle>
        {derived.upcomingEvents.length === 0 ? (
          <EmptyState
            title="رویداد آینده‌ای ثبت نشده"
            description="رویداد جدید را در تقویم اضافه کنید."
          />
        ) : (
          <ul className="space-y-2">
            {derived.upcomingEvents.map((event) => (
              <li
                key={event.id}
                className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-700"
              >
                <p className="text-sm font-semibold">{event.title}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {formatJalaliLongDate(new Date(event.start_at))} -{" "}
                  {formatPersianTime(new Date(event.start_at))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {rescheduleTaskId ? (
        <Card className="space-y-3">
          <CardTitle>زمان‌بندی مجدد سریع</CardTitle>
          <Input
            label="موعد جدید"
            type="datetime-local"
            value={rescheduleValue}
            onChange={(event) => setRescheduleValue(event.target.value)}
          />
          <div className="flex gap-2">
            <Button onClick={reschedule}>ذخیره</Button>
            <Button
              variant="ghost"
              onClick={() => {
                setRescheduleTaskId(null);
                setRescheduleValue("");
              }}
            >
              انصراف
            </Button>
          </div>
        </Card>
      ) : null}

      {errorMessage ? (
        <p className="text-sm text-rose-600 dark:text-rose-400">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
