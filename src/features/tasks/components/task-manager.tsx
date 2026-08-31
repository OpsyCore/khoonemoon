"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  CalendarClock,
  CheckCircle2,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { ReminderComposer } from "@/features/reminders/components/reminder-composer";
import {
  createTaskSchema,
  type CreateTaskInput,
} from "@/features/tasks/schemas";
import type { TaskMember, TaskRecord } from "@/features/tasks/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Badge } from "@/shared/ui/badge";
import {
  priorityLabel,
  priorityTone,
  statusLabel,
  statusTone,
} from "@/shared/utils/task-ranks";
import { Button } from "@/shared/ui/button";
import { Card, CardTitle } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { Input } from "@/shared/ui/input";
import { SectionLabel } from "@/shared/ui/section-label";
import {
  formatPersianDate,
  formatPersianTime,
  toPersianNumber,
} from "@/shared/utils/locale";
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

function recurrenceFromTask(task: TaskRecord): CreateTaskInput["recurrence"] {
  const first = task.task_recurrences?.[0];
  if (!first) return { frequency: "NONE" };

  return {
    frequency: first.frequency,
    intervalDays: first.interval_days ?? undefined,
    weekdays: first.weekdays ?? undefined,
  };
}

export function TaskManager({
  tasks,
  members,
  householdId,
  userId,
}: {
  tasks: TaskRecord[];
  members: TaskMember[];
  householdId: string | null;
  userId: string;
}) {
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<TaskRecord | null>(null);
  const [reschedulingTaskId, setReschedulingTaskId] = useState<string | null>(
    null,
  );
  const [rescheduleValue, setRescheduleValue] = useState("");

  const taskCounts = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    let dueToday = 0;
    let overdue = 0;
    let completed = 0;

    tasks.forEach((task) => {
      if (task.status === "COMPLETED") {
        completed += 1;
      }

      if (!task.due_at || task.status === "COMPLETED") return;
      const taskDate = new Date(task.due_at).toISOString().slice(0, 10);

      if (taskDate === todayStr) dueToday += 1;
      if (taskDate < todayStr) overdue += 1;
    });

    return { dueToday, overdue, completed };
  }, [tasks]);

  useEffect(() => {
    const channel = supabase
      .channel(`tasks-live-${householdId ?? "private"}-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_assignees" },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_recurrences" },
        () => router.refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, router, householdId, userId]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CreateTaskInput>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: "",
      description: "",
      visibility: householdId ? "HOUSEHOLD_SHARED" : "PRIVATE",
      priority: "NORMAL",
      status: "PENDING",
      dueAt: null,
      assigneeIds: [],
      recurrence: { frequency: "NONE" },
    },
  });

  const visibility = useWatch({ control, name: "visibility" });
  const recurrenceFrequency = useWatch({
    control,
    name: "recurrence.frequency",
  });
  const dueAtValue = useWatch({ control, name: "dueAt" });

  const onSubmit = async (values: CreateTaskInput) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const payload = {
      ...values,
      dueAt: values.dueAt ?? null,
    };

    const response = await fetch(
      editingTask ? `/api/tasks/${editingTask.id}` : "/api/tasks",
      {
        method: editingTask ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingTask
            ? {
                action: "update",
                data: payload,
              }
            : payload,
        ),
      },
    );

    const result = (await response.json().catch(() => ({}))) as {
      message?: string;
    };

    if (!response.ok) {
      setErrorMessage(result.message ?? "ذخیره تسک ناموفق بود.");
      return;
    }

    setSuccessMessage(editingTask ? "تسک بروزرسانی شد." : "تسک جدید ثبت شد.");
    setEditingTask(null);
    reset({
      title: "",
      description: "",
      visibility: householdId ? "HOUSEHOLD_SHARED" : "PRIVATE",
      priority: "NORMAL",
      status: "PENDING",
      dueAt: null,
      assigneeIds: [],
      recurrence: { frequency: "NONE" },
    });
    router.refresh();
  };

  const setEditTask = (task: TaskRecord) => {
    setEditingTask(task);
    setErrorMessage(null);
    setSuccessMessage(null);

    reset({
      title: task.title,
      description: task.description ?? "",
      visibility: task.visibility,
      priority: task.priority,
      status: task.status,
      dueAt: task.due_at,
      assigneeIds: task.task_assignees.map((item) => item.assignee_id),
      recurrence: recurrenceFromTask(task),
    });
  };

  const clearEdit = () => {
    setEditingTask(null);
    reset({
      title: "",
      description: "",
      visibility: householdId ? "HOUSEHOLD_SHARED" : "PRIVATE",
      priority: "NORMAL",
      status: "PENDING",
      dueAt: null,
      assigneeIds: [],
      recurrence: { frequency: "NONE" },
    });
  };

  const toggleComplete = async (task: TaskRecord) => {
    setErrorMessage(null);
    const action = task.status === "COMPLETED" ? "undo" : "complete";

    const response = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });

    if (!response.ok) {
      setErrorMessage("تغییر وضعیت تسک ناموفق بود.");
      return;
    }

    router.refresh();
  };

  const archiveTask = async (taskId: string) => {
    setErrorMessage(null);
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archive" }),
    });

    if (!response.ok) {
      setErrorMessage("آرشیو تسک ناموفق بود.");
      return;
    }

    router.refresh();
  };

  const deleteTask = async (taskId: string) => {
    setErrorMessage(null);
    const response = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });

    if (!response.ok) {
      setErrorMessage("حذف تسک ناموفق بود.");
      return;
    }

    router.refresh();
  };

  const submitReschedule = async (taskId: string) => {
    if (!rescheduleValue) {
      setErrorMessage("زمان جدید را انتخاب کنید.");
      return;
    }

    const response = await fetch(`/api/tasks/${taskId}`, {
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

    setReschedulingTaskId(null);
    setRescheduleValue("");
    router.refresh();
  };

  return (
    <section className="space-y-7">
      <div className="space-y-3">
        <SectionLabel>ثبت تسک</SectionLabel>
        <Card id="quick-add-task" className="space-y-4 p-5">
          <CardTitle>{editingTask ? "ویرایش تسک" : "تسک جدید"}</CardTitle>
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

              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-ink-soft">
                  اولویت
                </label>
                <select
                  className="h-11 w-full rounded-field border border-line-strong bg-paper px-3 text-sm text-ink outline-none transition focus:border-olive focus:ring-2 focus:ring-olive/25"
                  {...register("priority")}
                >
                  <option value="LOW">کم</option>
                  <option value="NORMAL">عادی</option>
                  <option value="HIGH">زیاد</option>
                  <option value="CRITICAL">بحرانی</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-ink-soft">
                  وضعیت
                </label>
                <select
                  className="h-11 w-full rounded-field border border-line-strong bg-paper px-3 text-sm text-ink outline-none transition focus:border-olive focus:ring-2 focus:ring-olive/25"
                  {...register("status")}
                >
                  <option value="PENDING">در انتظار</option>
                  <option value="IN_PROGRESS">در حال انجام</option>
                  <option value="COMPLETED">تکمیل‌شده</option>
                  <option value="SKIPPED">رد شده</option>
                </select>
              </div>

              <Input
                label="موعد"
                type="datetime-local"
                value={toDateTimeLocal(dueAtValue ?? null)}
                onChange={(event) => {
                  setValue("dueAt", fromDateTimeLocal(event.target.value));
                }}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-ink-soft">
                مسئول
              </label>
              <select
                multiple
                className="min-h-24 w-full rounded-field border border-line-strong bg-paper px-3 py-2 text-sm text-ink outline-none transition focus:border-olive focus:ring-2 focus:ring-olive/25"
                {...register("assigneeIds")}
              >
                {visibility === "PRIVATE" ? (
                  <option value={userId}>من</option>
                ) : (
                  members.map((member) => (
                    <option key={member.user_id} value={member.user_id}>
                      {member.full_name}
                    </option>
                  ))
                )}
              </select>
              {errors.assigneeIds ? (
                <p className="text-xs text-danger-ink">
                  {errors.assigneeIds.message as string}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-ink-soft">
                  تکرار
                </label>
                <select
                  className="h-11 w-full rounded-field border border-line-strong bg-paper px-3 text-sm text-ink outline-none transition focus:border-olive focus:ring-2 focus:ring-olive/25"
                  {...register("recurrence.frequency")}
                >
                  <option value="NONE">بدون تکرار</option>
                  <option value="DAILY">روزانه</option>
                  <option value="INTERVAL_DAYS">هر چند روز</option>
                  <option value="WEEKLY">هفتگی (روزهای منتخب)</option>
                  <option value="MONTHLY">ماهانه</option>
                  <option value="YEARLY">سالانه</option>
                </select>
              </div>

              {recurrenceFrequency === "INTERVAL_DAYS" ? (
                <Input
                  label="فاصله روز"
                  type="number"
                  min={1}
                  max={365}
                  error={errors.recurrence?.intervalDays?.message}
                  {...register("recurrence.intervalDays", {
                    valueAsNumber: true,
                  })}
                />
              ) : null}

              {recurrenceFrequency === "WEEKLY" ? (
                <Input
                  label="روزهای هفته (مثلاً 1,4)"
                  hint="۰=یکشنبه تا ۶=شنبه"
                  error={
                    errors.recurrence?.weekdays?.message as string | undefined
                  }
                  onChange={(event) => {
                    const values = event.target.value
                      .split(",")
                      .map((item) => Number(item.trim()))
                      .filter(
                        (item) =>
                          Number.isInteger(item) && item >= 0 && item <= 6,
                      );
                    setValue("recurrence.weekdays", values);
                  }}
                />
              ) : null}
            </div>

            <div className="flex gap-2 pt-1">
              <Button type="submit" className="flex-1" isLoading={isSubmitting}>
                {editingTask ? "ذخیره تغییرات" : "افزودن تسک"}
              </Button>
              {editingTask ? (
                <Button type="button" variant="ghost" onClick={clearEdit}>
                  انصراف
                </Button>
              ) : null}
            </div>
          </form>
        </Card>
      </div>

      {errorMessage ? (
        <p className="text-sm text-danger-ink">{errorMessage}</p>
      ) : null}
      {successMessage ? (
        <p className="text-sm text-olive-ink">{successMessage}</p>
      ) : null}

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <SectionLabel className="min-w-0 flex-1">همه تسک‌ها</SectionLabel>
          <div className="flex shrink-0 flex-wrap gap-1.5">
            {taskCounts.overdue > 0 ? (
              <Badge tone="danger">
                {toPersianNumber(taskCounts.overdue)} معوق
              </Badge>
            ) : null}
            {taskCounts.dueToday > 0 ? (
              <Badge tone="warning">
                {toPersianNumber(taskCounts.dueToday)} امروز
              </Badge>
            ) : null}
            {taskCounts.completed > 0 ? (
              <Badge tone="success">
                {toPersianNumber(taskCounts.completed)} تکمیل‌شده
              </Badge>
            ) : null}
          </div>
        </div>

        {tasks.length === 0 ? (
          <EmptyState
            title="هنوز تسکی ثبت نشده"
            description="اولین تسک شخصی یا اشتراکی‌تان را از فرم بالا بنویسید."
          />
        ) : (
          <ul className="divide-y divide-line rounded-card border border-line bg-card shadow-paper">
            {tasks.map((task) => {
              const completed = task.status === "COMPLETED";
              const dueLabel = task.due_at
                ? `${formatPersianDate(new Date(task.due_at))} — ${formatPersianTime(
                    new Date(task.due_at),
                  )}`
                : "بدون موعد";

              return (
                <li key={task.id} className="space-y-3 px-4 py-4">
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggleComplete(task)}
                      aria-label={completed ? "بازگردانی" : "تکمیل"}
                      className={cn(
                        "mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border transition",
                        completed
                          ? "border-olive bg-olive text-cream dark:text-[#221c14]"
                          : "border-line-strong bg-paper text-transparent hover:border-olive hover:text-olive/50",
                      )}
                    >
                      <CheckCircle2 className="size-3.5" strokeWidth={2} />
                    </button>

                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-sm font-medium",
                          completed ? "text-muted line-through" : "text-ink",
                        )}
                      >
                        {task.title}
                      </p>
                      {task.description ? (
                        <p className="mt-0.5 text-[12px] leading-5 text-muted">
                          {task.description}
                        </p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Badge tone={statusTone(task.status)}>
                          {statusLabel(task.status)}
                        </Badge>
                        <Badge tone={priorityTone(task.priority)}>
                          {priorityLabel(task.priority)}
                        </Badge>
                        <Badge tone="neutral">
                          {task.visibility === "PRIVATE" ? "خصوصی" : "اشتراکی"}
                        </Badge>
                        <span className="text-[11px] text-muted">
                          {dueLabel}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => setEditTask(task)}
                        aria-label="ویرایش"
                        className="inline-flex size-7 items-center justify-center rounded-full text-muted transition hover:bg-sunken hover:text-ink"
                      >
                        <Pencil className="size-3.5" strokeWidth={1.75} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setReschedulingTaskId(task.id);
                          setRescheduleValue(toDateTimeLocal(task.due_at));
                        }}
                        aria-label="زمان‌بندی مجدد"
                        className="inline-flex size-7 items-center justify-center rounded-full text-muted transition hover:bg-sunken hover:text-ink"
                      >
                        <CalendarClock
                          className="size-3.5"
                          strokeWidth={1.75}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => archiveTask(task.id)}
                        aria-label="آرشیو"
                        className="inline-flex size-7 items-center justify-center rounded-full text-muted transition hover:bg-sunken hover:text-ink"
                      >
                        <RotateCcw className="size-3.5" strokeWidth={1.75} />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteTask(task.id)}
                        aria-label="حذف"
                        className="inline-flex size-7 items-center justify-center rounded-full text-muted transition hover:bg-danger-soft hover:text-danger-ink"
                      >
                        <Trash2 className="size-3.5" strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>

                  <div className="pr-9">
                    <ReminderComposer
                      targetType="TASK"
                      targetId={task.id}
                      baseDateTime={task.due_at ?? new Date().toISOString()}
                      householdId={task.household_id}
                      onCreated={() => router.refresh()}
                    />
                  </div>

                  {reschedulingTaskId === task.id ? (
                    <div className="mr-9 flex flex-col gap-2 rounded-field border border-olive/50 bg-olive-soft/40 p-3">
                      <Input
                        label="موعد جدید"
                        type="datetime-local"
                        value={rescheduleValue}
                        onChange={(event) =>
                          setRescheduleValue(event.target.value)
                        }
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => submitReschedule(task.id)}
                        >
                          ذخیره موعد جدید
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setReschedulingTaskId(null);
                            setRescheduleValue("");
                          }}
                        >
                          انصراف
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
