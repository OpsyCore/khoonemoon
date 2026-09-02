"use client";

import { AlarmClockCheck, CalendarClock, Check, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { EventRecord } from "@/features/calendar/types";
import type { TaskRecord } from "@/features/tasks/types";
import { Badge } from "@/shared/ui/badge";
import { statusLabel, statusTone } from "@/shared/utils/task-ranks";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { SectionLabel } from "@/shared/ui/section-label";
import { formatJalaliLongDate } from "@/shared/utils/jalali";
import { formatPersianTime, toPersianNumber } from "@/shared/utils/locale";
import { cn } from "@/shared/utils/cn";

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

function QuietEmpty({ text }: { text: string }) {
  return (
    <p className="rounded-field border border-dashed border-line-strong/70 px-4 py-4 text-center text-[13px] text-muted">
      {text}
    </p>
  );
}

function CompleteCircle({
  completed,
  onClick,
  label,
}: {
  completed: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border transition",
        completed
          ? "border-olive bg-olive text-cream dark:text-[#221c14]"
          : "border-line-strong bg-paper text-transparent hover:border-olive hover:text-olive/50",
      )}
    >
      <Check className="size-3.5" strokeWidth={2.5} />
    </button>
  );
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
    <div className="space-y-7">
      {derived.overdueTasks.length > 0 ? (
        <section className="space-y-3">
          <SectionLabel>کارهای معوق</SectionLabel>
          <ul className="divide-y divide-line rounded-card border border-line bg-card shadow-paper">
            {derived.overdueTasks.map((task) => (
              <li key={task.id} className="flex items-start gap-3 px-4 py-3.5">
                <CompleteCircle
                  completed={false}
                  onClick={() => completeToggle(task)}
                  label={`تکمیل ${task.title}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{task.title}</p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    موعد:{" "}
                    {task.due_at
                      ? formatJalaliLongDate(new Date(task.due_at))
                      : "نامشخص"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Badge tone="danger">معوق</Badge>
                  <button
                    type="button"
                    onClick={() => {
                      setRescheduleTaskId(task.id);
                      setRescheduleValue(toDateTimeLocal(task.due_at));
                    }}
                    className="inline-flex size-7 items-center justify-center rounded-full text-muted transition hover:bg-sunken hover:text-ink"
                    aria-label="زمان‌بندی مجدد"
                  >
                    <RotateCcw className="size-3.5" strokeWidth={1.75} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <SectionLabel>آیتم‌های امروز</SectionLabel>
        {derived.todayTasks.length === 0 ? (
          <QuietEmpty text="برای امروز تسکی ثبت نشده است — روز آرامی داشته باشید." />
        ) : (
          <ul className="divide-y divide-line rounded-card border border-line bg-card shadow-paper">
            {derived.todayTasks.map((task) => {
              const completed = task.status === "COMPLETED";
              return (
                <li
                  key={task.id}
                  className="flex items-start gap-3 px-4 py-3.5"
                >
                  <CompleteCircle
                    completed={completed}
                    onClick={() => completeToggle(task)}
                    label={
                      completed
                        ? `بازگردانی ${task.title}`
                        : `تکمیل ${task.title}`
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        completed ? "text-muted line-through" : "text-ink",
                      )}
                    >
                      {task.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {task.due_at
                        ? formatPersianTime(new Date(task.due_at))
                        : "بدون زمان"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Badge tone={statusTone(task.status)}>
                      {statusLabel(task.status)}
                    </Badge>
                    {completed ? (
                      <button
                        type="button"
                        onClick={() => completeToggle(task)}
                        className="inline-flex size-7 items-center justify-center rounded-full text-muted transition hover:bg-sunken hover:text-ink"
                        aria-label="بازگردانی"
                      >
                        <AlarmClockCheck
                          className="size-3.5"
                          strokeWidth={1.75}
                        />
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <SectionLabel>رویدادهای پیش‌رو</SectionLabel>
        {derived.upcomingEvents.length === 0 ? (
          <QuietEmpty text="رویداد آینده‌ای ثبت نشده — از تقویم اضافه کنید." />
        ) : (
          <ul className="divide-y divide-line rounded-card border border-line bg-card shadow-paper">
            {derived.upcomingEvents.map((event) => (
              <li
                key={event.id}
                className="flex items-center gap-3 px-4 py-3.5"
              >
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-clay-soft text-clay-ink">
                  <CalendarClock className="size-4" strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{event.title}</p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {formatJalaliLongDate(new Date(event.start_at))} —{" "}
                    {formatPersianTime(new Date(event.start_at))}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {rescheduleTaskId ? (
        <section className="space-y-3 rounded-card border border-olive/50 bg-olive-soft/40 p-4">
          <p className="text-sm font-semibold text-ink">زمان‌بندی مجدد سریع</p>
          <Input
            label="موعد جدید"
            type="datetime-local"
            value={rescheduleValue}
            onChange={(event) => setRescheduleValue(event.target.value)}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={reschedule}>
              ذخیره
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setRescheduleTaskId(null);
                setRescheduleValue("");
              }}
            >
              انصراف
            </Button>
          </div>
        </section>
      ) : null}

      {errorMessage ? (
        <p className="text-sm text-danger-ink">{errorMessage}</p>
      ) : null}
    </div>
  );
}
