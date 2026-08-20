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
import { priorityLabel, priorityTone, statusLabel, statusTone } from "@/shared/utils/task-ranks";
import { Button } from "@/shared/ui/button";
import { Card, CardDescription, CardTitle } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { Input } from "@/shared/ui/input";
import { formatPersianDate, formatPersianTime } from "@/shared/utils/locale";

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
    <div className="space-y-4">
      <Card className="space-y-3">
        <CardTitle>{editingTask ? "ویرایش تسک" : "تسک جدید"}</CardTitle>
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

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                اولویت
              </label>
              <select
                className="h-11 w-full rounded-2xl border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                {...register("priority")}
              >
                <option value="LOW">کم</option>
                <option value="NORMAL">عادی</option>
                <option value="HIGH">زیاد</option>
                <option value="CRITICAL">بحرانی</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                وضعیت
              </label>
              <select
                className="h-11 w-full rounded-2xl border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
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
            <label className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
              مسئول
            </label>
            <select
              multiple
              className="min-h-24 w-full rounded-2xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
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
              <p className="text-xs text-rose-600 dark:text-rose-400">
                {errors.assigneeIds.message as string}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                تکرار
              </label>
              <select
                className="h-11 w-full rounded-2xl border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
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

          <div className="flex gap-2">
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

      <Card className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-sm font-semibold">{taskCounts.dueToday}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">امروز</p>
        </div>
        <div>
          <p className="text-sm font-semibold">{taskCounts.overdue}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">معوق</p>
        </div>
        <div>
          <p className="text-sm font-semibold">{taskCounts.completed}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">تکمیل‌شده</p>
        </div>
      </Card>

      {errorMessage ? (
        <p className="text-sm text-rose-600 dark:text-rose-400">
          {errorMessage}
        </p>
      ) : null}
      {successMessage ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          {successMessage}
        </p>
      ) : null}

      {tasks.length === 0 ? (
        <EmptyState
          title="تسکی ندارید"
          description="اولین تسک شخصی یا اشتراکی خود را از فرم بالا ایجاد کنید."
        />
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const dueLabel = task.due_at
              ? `${formatPersianDate(new Date(task.due_at))} - ${formatPersianTime(
                  new Date(task.due_at),
                )}`
              : "بدون موعد";

            return (
              <Card key={task.id} className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle>{task.title}</CardTitle>
                    <CardDescription>
                      {task.description || "بدون توضیحات"}
                    </CardDescription>
                  </div>
                  <Badge tone={statusTone(task.status)}>{statusLabel(task.status)}</Badge>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge tone="neutral">
                    {task.visibility === "PRIVATE" ? "خصوصی" : "اشتراکی"}
                  </Badge>
                  <Badge  tone={priorityTone(task.priority)}>{priorityLabel(task.priority)}</Badge>
                  <Badge tone="neutral">{dueLabel}</Badge>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleComplete(task)}
                  >
                    <CheckCircle2 className="size-4" />
                    {task.status === "COMPLETED" ? "بازگردانی" : "تکمیل"}
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditTask(task)}
                  >
                    <Pencil className="size-4" />
                    ویرایش
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setReschedulingTaskId(task.id);
                      setRescheduleValue(toDateTimeLocal(task.due_at));
                    }}
                  >
                    <CalendarClock className="size-4" />
                    زمان‌بندی مجدد
                  </Button>

                  <ReminderComposer
                    targetType="TASK"
                    targetId={task.id}
                    baseDateTime={task.due_at ?? new Date().toISOString()}
                    householdId={task.household_id}
                    onCreated={() => router.refresh()}
                  />

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => archiveTask(task.id)}
                  >
                    <RotateCcw className="size-4" />
                    آرشیو
                  </Button>

                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => deleteTask(task.id)}
                  >
                    <Trash2 className="size-4" />
                    حذف
                  </Button>
                </div>

                {reschedulingTaskId === task.id ? (
                  <div className="flex flex-col gap-2 rounded-2xl border border-zinc-200 p-3 dark:border-zinc-700">
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
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
