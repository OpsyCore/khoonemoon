"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import {
  createChoreSchema,
  type CreateChoreInput,
} from "@/features/chores/schemas";
import type { ChoreFrequency } from "@/features/chores/types";
import { CHORE_FREQUENCIES } from "@/features/chores/types";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardDescription, CardTitle } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/utils/cn";

type ChoreMember = {
  userId: string;
  fullName: string;
};

type ApiChore = {
  id: string;
  household_id?: string;
  householdId?: string;
  created_by?: string;
  createdBy?: string;
  default_assignee_id?: string | null;
  defaultAssigneeId?: string | null;
  title: string;
  description?: string | null;
  is_active?: boolean;
  isActive?: boolean;
  start_date?: string;
  startDate?: string;
  chore_recurrences?: Array<{
    frequency: string;
    interval_days?: number | null;
    weekdays?: number[] | null;
  }> | null;
  chore_rotations?: Array<{
    user_id: string;
    position: number;
  }> | null;
  recurrence?: {
    frequency: string;
    intervalDays?: number | null;
    weekdays?: number[] | null;
  } | null;
  rotation?: Array<{ userId: string; position: number }> | null;
};

type ListResponse = {
  chores?: ApiChore[];
  members?: Array<{
    user_id?: string;
    userId?: string;
    full_name?: string;
    fullName?: string;
    profiles?:
      | { full_name?: string }
      | { full_name?: string }[]
      | null;
  }>;
  householdId?: string | null;
  household_id?: string | null;
  message?: string;
};

type NormalizedChore = ReturnType<typeof normalizeChore>;

const WEEKDAYS = [
  { value: 0, label: "یکشنبه" },
  { value: 1, label: "دوشنبه" },
  { value: 2, label: "سه‌شنبه" },
  { value: 3, label: "چهارشنبه" },
  { value: 4, label: "پنجشنبه" },
  { value: 5, label: "جمعه" },
  { value: 6, label: "شنبه" },
] as const;

const FREQUENCY_LABELS: Record<(typeof CHORE_FREQUENCIES)[number], string> = {
  NONE: "بدون تکرار",
  DAILY: "هر روز",
  INTERVAL_DAYS: "هر چند روز",
  WEEKLY: "هفتگی",
  MONTHLY: "ماهانه",
  YEARLY: "سالانه",
};

function todayDateOnly() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeMember(
  raw: NonNullable<ListResponse["members"]>[number],
): ChoreMember {
  const userId = raw.userId ?? raw.user_id ?? "";
  let fullName = raw.fullName ?? raw.full_name ?? "";
  if (!fullName && raw.profiles) {
    const p = Array.isArray(raw.profiles) ? raw.profiles[0] : raw.profiles;
    fullName = p?.full_name ?? "";
  }
  return { userId, fullName: fullName || "کاربر" };
}

function normalizeChore(chore: ApiChore) {
  const recurrence =
    chore.recurrence ??
    (chore.chore_recurrences?.[0]
      ? {
          frequency: chore.chore_recurrences[0].frequency,
          intervalDays: chore.chore_recurrences[0].interval_days,
          weekdays: chore.chore_recurrences[0].weekdays,
        }
      : null);

  const rotation =
    chore.rotation ??
    (chore.chore_rotations ?? []).map((item) => ({
      userId: item.user_id,
      position: item.position,
    }));

  return {
    id: chore.id,
    title: chore.title,
    description: chore.description ?? null,
    isActive: chore.isActive ?? chore.is_active ?? true,
    startDate: chore.startDate ?? chore.start_date ?? "",
    defaultAssigneeId:
      chore.defaultAssigneeId ?? chore.default_assignee_id ?? null,
    recurrence,
    rotation,
  };
}

function buildDefaultValues(
  userId: string,
  chore?: NormalizedChore | null,
): CreateChoreInput {
  if (!chore) {
    return {
      title: "",
      description: "",
      startDate: todayDateOnly(),
      defaultAssigneeId: userId,
      recurrence: { frequency: "NONE", intervalDays: null, weekdays: null },
      rotationUserIds: [],
    };
  }

  const frequency = (chore.recurrence?.frequency ??
    "NONE") as ChoreFrequency;

  return {
    title: chore.title,
    description: chore.description ?? "",
    startDate: chore.startDate || todayDateOnly(),
    defaultAssigneeId: chore.defaultAssigneeId,
    recurrence: {
      frequency,
      intervalDays:
        frequency === "INTERVAL_DAYS"
          ? (chore.recurrence?.intervalDays ?? null)
          : null,
      weekdays:
        frequency === "WEEKLY" ? (chore.recurrence?.weekdays ?? []) : null,
    },
    rotationUserIds: chore.rotation.map((item) => item.userId),
  };
}

export function ChoreManager({
  householdId,
  userId,
  initialMembers = [],
}: {
  householdId: string;
  userId: string;
  initialMembers?: ChoreMember[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [chores, setChores] = useState<NormalizedChore[]>([]);
  const [members, setMembers] = useState<ChoreMember[]>(initialMembers);
  const [showForm, setShowForm] = useState(false);
  const [editingChoreId, setEditingChoreId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateChoreInput>({
    resolver: zodResolver(createChoreSchema) as Resolver<CreateChoreInput>,
    defaultValues: buildDefaultValues(userId),
  });

  const frequency = useWatch({ control, name: "recurrence.frequency" });
  const rotationUserIds =
    useWatch({ control, name: "rotationUserIds" }) ?? [];
  const weekdays = useWatch({ control, name: "recurrence.weekdays" }) ?? [];

  const isEditing = Boolean(editingChoreId);

  async function loadChores() {
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/chores");
      const data = (await response.json()) as ListResponse;
      if (!response.ok) {
        throw new Error(data.message || "بارگذاری کارها ناموفق بود.");
      }

      setChores((data.chores ?? []).map(normalizeChore));

      if (data.members && data.members.length > 0) {
        setMembers(data.members.map((item) => normalizeMember(item)));
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "بارگذاری کارها ناموفق بود.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadChores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId]);

  const activeChores = useMemo(
    () => chores.filter((chore) => chore.isActive),
    [chores],
  );

  const memberName = (id: string | null | undefined) => {
    if (!id) return "—";
    return members.find((member) => member.userId === id)?.fullName ?? "کاربر";
  };

  function openCreateForm() {
    setEditingChoreId(null);
    setShowForm(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    reset(buildDefaultValues(userId));
  }

  function openEditForm(chore: NormalizedChore) {
    setEditingChoreId(chore.id);
    setShowForm(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    reset(buildDefaultValues(userId, chore));
  }

  function closeForm() {
    setShowForm(false);
    setEditingChoreId(null);
    setErrorMessage(null);
    reset(buildDefaultValues(userId));
  }

  function toggleFormHeaderButton() {
    if (showForm) {
      closeForm();
      return;
    }
    openCreateForm();
  }

  async function onSubmit(values: CreateChoreInput) {
    setErrorMessage(null);
    setSuccessMessage(null);

    const payload: CreateChoreInput = {
      ...values,
      description: values.description?.trim() ? values.description : null,
      defaultAssigneeId: values.defaultAssigneeId || null,
      rotationUserIds: values.rotationUserIds ?? [],
      recurrence: {
        frequency: values.recurrence.frequency,
        intervalDays:
          values.recurrence.frequency === "INTERVAL_DAYS"
            ? values.recurrence.intervalDays
            : null,
        weekdays:
          values.recurrence.frequency === "WEEKLY"
            ? values.recurrence.weekdays
            : null,
      },
    };

    const url = editingChoreId
      ? `/api/chores/${editingChoreId}`
      : "/api/chores";
    const method = editingChoreId ? "PATCH" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setErrorMessage(
        data.message ||
          (data.errors
            ? "اطلاعات فرم معتبر نیست."
            : isEditing
              ? "ویرایش کار خانه ناموفق بود."
              : "ثبت کار خانه ناموفق بود."),
      );
      return;
    }

    setSuccessMessage(
      isEditing ? "کار خانه ویرایش شد." : "کار خانه ثبت شد.",
    );
    closeForm();
    await loadChores();
    router.refresh();
  }

  async function completeChore(choreId: string) {
    setSubmittingId(choreId);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const response = await fetch(`/api/chores/${choreId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forDate: todayDateOnly() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "ثبت انجام کار ناموفق بود.");
      }
      setSuccessMessage("انجام کار برای امروز ثبت شد.");
      await loadChores();
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "ثبت انجام کار ناموفق بود.",
      );
    } finally {
      setSubmittingId(null);
    }
  }

async function deleteChore(choreId: string, title?: string) {
    const label = title?.trim() ? `«${title.trim()}»` : "این کار";
    const ok = window.confirm(
      `حذف ${label}؟\nاز لیست فعال‌ها برداشته می‌شود (تاریخچه انجام‌ها می‌ماند).`,
    );
    if (!ok) return;

    setSubmittingId(choreId);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const response = await fetch(`/api/chores/${choreId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "حذف کار خانه ناموفق بود.");
      }
      setSuccessMessage("کار خانه حذف شد.");
      if (editingChoreId === choreId) {
        closeForm();
      }
      await loadChores();
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "حذف کار خانه ناموفق بود.",
      );
    } finally {
      setSubmittingId(null);
    }
  }

  function toggleWeekday(day: number) {
    const current = new Set(weekdays ?? []);
    if (current.has(day)) current.delete(day);
    else current.add(day);
    setValue("recurrence.weekdays", Array.from(current).sort(), {
      shouldValidate: true,
    });
  }

  function toggleRotation(memberId: string) {
    const current = new Set(rotationUserIds);
    if (current.has(memberId)) current.delete(memberId);
    else current.add(memberId);
    setValue("rotationUserIds", Array.from(current), {
      shouldValidate: true,
    });
  }

  return (
    <div id="chores" className="space-y-4">
      <section className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            کارهای خانه
          </h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            تعریف کار مشترک، تکرار، چرخش نوبت و ثبت انجام روزانه.
          </p>
        </div>
        <Button size="sm" type="button" onClick={toggleFormHeaderButton}>
          <Plus className="size-4" />
          {showForm ? "بستن فرم" : "کار جدید"}
        </Button>
      </section>

      {errorMessage ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          {errorMessage}
        </p>
      ) : null}
      {successMessage ? (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          {successMessage}
        </p>
      ) : null}

      {showForm ? (
        <Card id="quick-add-chore" className="space-y-4">
          <div className="space-y-1">
            <CardTitle>
              {isEditing ? "ویرایش کار خانه" : "کار خانه جدید"}
            </CardTitle>
            <CardDescription>
              {isEditing
                ? "تغییرات روی عنوان، تکرار، مسئول و چرخش اعمال می‌شود. تاریخچه انجام‌های قبلی حفظ می‌ماند."
                : "کار فقط در سطح خانه مشترک است و برای همه اعضا دیده می‌شود."}
            </CardDescription>
          </div>

          <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
            <Input
              label="عنوان"
              placeholder="مثلاً جارو کردن پذیرایی"
              error={errors.title?.message}
              {...register("title")}
            />

            <label className="block space-y-1.5">
              <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-100">
                توضیحات (اختیاری)
              </span>
              <textarea
                className="min-h-24 w-full rounded-2xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                {...register("description")}
              />
            </label>

            <Input
              label="تاریخ شروع"
              type="date"
              error={errors.startDate?.message}
              {...register("startDate")}
            />

            <label className="block space-y-1.5">
              <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-100">
                مسئول پیش‌فرض
              </span>
              <select
                className="h-11 w-full rounded-2xl border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                {...register("defaultAssigneeId")}
              >
                <option value="">بدون مسئول ثابت</option>
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.fullName}
                  </option>
                ))}
              </select>
              {errors.defaultAssigneeId?.message ? (
                <p className="text-xs text-rose-600 dark:text-rose-400">
                  {errors.defaultAssigneeId.message}
                </p>
              ) : null}
            </label>

            <label className="block space-y-1.5">
              <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-100">
                تکرار
              </span>
              <select
                className="h-11 w-full rounded-2xl border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                {...register("recurrence.frequency")}
              >
                {CHORE_FREQUENCIES.map((item) => (
                  <option key={item} value={item}>
                    {FREQUENCY_LABELS[item]}
                  </option>
                ))}
              </select>
            </label>

            {frequency === "INTERVAL_DAYS" ? (
              <Input
                label="هر چند روز یک‌بار"
                type="number"
                min={1}
                error={errors.recurrence?.intervalDays?.message}
                {...register("recurrence.intervalDays", {
                  valueAsNumber: true,
                })}
              />
            ) : null}

            {frequency === "WEEKLY" ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                  روزهای هفته
                </p>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map((day) => {
                    const active = (weekdays ?? []).includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleWeekday(day.value)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs transition",
                          active
                            ? "border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
                            : "border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300",
                        )}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
                {errors.recurrence?.weekdays?.message ? (
                  <p className="text-xs text-rose-600 dark:text-rose-400">
                    {errors.recurrence.weekdays.message}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-2">
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                چرخش نوبت (اختیاری)
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                اگر چند نفر را انتخاب کنید، نوبت به‌صورت گردشی بین آن‌ها عوض
                می‌شود.
              </p>
              <div className="space-y-2">
                {members.map((member) => {
                  const checked = rotationUserIds.includes(member.userId);
                  return (
                    <label
                      key={member.userId}
                      className="flex items-center justify-between rounded-2xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
                    >
                      <span>{member.fullName}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRotation(member.userId)}
                      />
                    </label>
                  );
                })}
              </div>
              {errors.rotationUserIds?.message ? (
                <p className="text-xs text-rose-600 dark:text-rose-400">
                  {errors.rotationUserIds.message}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:flex-1"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {isEditing ? "در حال ذخیره..." : "در حال ثبت..."}
                  </>
                ) : isEditing ? (
                  "ذخیره تغییرات"
                ) : (
                  "ثبت کار خانه"
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full sm:w-auto"
                disabled={isSubmitting}
                onClick={closeForm}
              >
                انصراف
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {loading ? (
        <Card className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="size-4 animate-spin" />
          در حال بارگذاری کارها...
        </Card>
      ) : activeChores.length === 0 ? (
        <EmptyState
          title="هنوز کار خانه‌ای تعریف نشده"
          description="اولین کار مشترک خانه را بسازید تا چرخش و پیگیری انجام آن شروع شود."
        />
      ) : (
        <ul className="space-y-3">
          {activeChores.map((chore) => {
            const freq = (chore.recurrence?.frequency ??
              "NONE") as (typeof CHORE_FREQUENCIES)[number];
            const busy = submittingId === chore.id;
            const editingThis = editingChoreId === chore.id;

            return (
              <li key={chore.id}>
                <Card
                  className={cn(
                    "space-y-3",
                    editingThis &&
                      "ring-2 ring-sky-400/60 dark:ring-sky-500/40",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle>{chore.title}</CardTitle>
                      {chore.description ? (
                        <CardDescription>{chore.description}</CardDescription>
                      ) : null}
                    </div>
                    <Badge tone="neutral">
                      {FREQUENCY_LABELS[freq] ?? freq}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <span>شروع: {chore.startDate || "—"}</span>
                    <span>
                      مسئول پیش‌فرض: {memberName(chore.defaultAssigneeId)}
                    </span>
                    {chore.rotation.length > 0 ? (
                      <span>
                        چرخش:{" "}
                        {chore.rotation
                          .map((item) => memberName(item.userId))
                          .join(" ← ")}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy}
                      onClick={() => void completeChore(chore.id)}
                    >
                      {busy ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-4" />
                      )}
                      انجام امروز
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => openEditForm(chore)}
                    >
                      <Pencil className="size-4" />
                      {editingThis ? "در حال ویرایش" : "ویرایش"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => void deleteChore(chore.id, chore.title)}
                    >
                      <Trash2 className="size-4" />
                      حذف
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
