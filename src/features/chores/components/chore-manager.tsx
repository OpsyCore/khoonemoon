"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
import { SectionLabel } from "@/shared/ui/section-label";
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
    profiles?: { full_name?: string } | { full_name?: string }[] | null;
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

  const frequency = (chore.recurrence?.frequency ?? "NONE") as ChoreFrequency;

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
  const rotationUserIds = useWatch({ control, name: "rotationUserIds" }) ?? [];
  const weekdays = useWatch({ control, name: "recurrence.weekdays" }) ?? [];

  const isEditing = Boolean(editingChoreId);

  async function fetchChoreList() {
    const response = await fetch("/api/chores");
    const data = (await response.json()) as ListResponse;
    if (!response.ok) {
      throw new Error(data.message || "بارگذاری کارها ناموفق بود.");
    }
    return data;
  }

  function applyChoreList(data: ListResponse) {
    setChores((data.chores ?? []).map(normalizeChore));
    if (data.members && data.members.length > 0) {
      setMembers(data.members.map((item) => normalizeMember(item)));
    }
  }

  async function loadChores() {
    setLoading(true);
    setErrorMessage(null);
    try {
      applyChoreList(await fetchChoreList());
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "بارگذاری کارها ناموفق بود.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    void fetchChoreList()
      .then((data) => {
        if (cancelled) return;
        applyChoreList(data);
        setErrorMessage(null);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setErrorMessage(
          error instanceof Error ? error.message : "بارگذاری کارها ناموفق بود.",
        );
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
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

    setSuccessMessage(isEditing ? "کار خانه ویرایش شد." : "کار خانه ثبت شد.");
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
      <SectionLabel
        action={
          <Button size="sm" type="button" onClick={toggleFormHeaderButton}>
            <Plus className="size-4" strokeWidth={2} />
            {showForm ? "بستن فرم" : "کار جدید"}
          </Button>
        }
      >
        کارهای خانه
      </SectionLabel>

      {errorMessage ? (
        <p className="rounded-field border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger-ink">
          {errorMessage}
        </p>
      ) : null}
      {successMessage ? (
        <p className="rounded-field border border-olive/50 bg-olive-soft px-3 py-2 text-sm text-olive-ink">
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
              <span className="block text-[13px] font-medium text-ink-soft">
                توضیحات (اختیاری)
              </span>
              <textarea
                className="min-h-24 w-full rounded-field border border-line-strong bg-paper px-3 py-2 text-sm text-ink outline-none transition focus:border-olive focus:ring-2 focus:ring-olive/25"
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
              <span className="block text-[13px] font-medium text-ink-soft">
                مسئول پیش‌فرض
              </span>
              <select
                className="h-11 w-full rounded-field border border-line-strong bg-paper px-3 text-sm text-ink outline-none transition focus:border-olive focus:ring-2 focus:ring-olive/25"
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
                <p className="text-xs text-danger-ink">
                  {errors.defaultAssigneeId.message}
                </p>
              ) : null}
            </label>

            <label className="block space-y-1.5">
              <span className="block text-[13px] font-medium text-ink-soft">
                تکرار
              </span>
              <select
                className="h-11 w-full rounded-field border border-line-strong bg-paper px-3 text-sm text-ink outline-none transition focus:border-olive focus:ring-2 focus:ring-olive/25"
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
                <p className="text-[13px] font-medium text-ink-soft">
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
                          "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                          active
                            ? "border-olive/60 bg-olive-soft text-olive-ink"
                            : "border-line-strong bg-paper text-ink-soft hover:bg-sunken",
                        )}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
                {errors.recurrence?.weekdays?.message ? (
                  <p className="text-xs text-danger-ink">
                    {errors.recurrence.weekdays.message}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-2">
              <p className="text-[13px] font-medium text-ink-soft">
                چرخش نوبت (اختیاری)
              </p>
              <p className="text-xs text-muted">
                اگر چند نفر را انتخاب کنید، نوبت به‌صورت گردشی بین آن‌ها عوض
                می‌شود.
              </p>
              <div className="space-y-2">
                {members.map((member) => {
                  const checked = rotationUserIds.includes(member.userId);
                  return (
                    <label
                      key={member.userId}
                      className="flex items-center justify-between rounded-field border border-line bg-paper px-3.5 py-2.5 text-sm"
                    >
                      <span>{member.fullName}</span>
                      <input
                        type="checkbox"
                        className="size-4 accent-[#9AA06E]"
                        checked={checked}
                        onChange={() => toggleRotation(member.userId)}
                      />
                    </label>
                  );
                })}
              </div>
              {errors.rotationUserIds?.message ? (
                <p className="text-xs text-danger-ink">
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
        <Card className="flex items-center gap-2 text-sm text-muted">
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
                    editingThis && "ring-2 ring-olive/30 ",
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

                  <div className="flex flex-wrap gap-2 text-xs text-muted">
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

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void completeChore(chore.id)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-full bg-olive px-3.5 text-[12px] font-medium text-cream transition hover:bg-olive-deep disabled:opacity-60 dark:text-[#221c14]"
                    >
                      {busy ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-3.5" strokeWidth={2} />
                      )}
                      انجام امروز
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => openEditForm(chore)}
                      aria-label="ویرایش"
                      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line-strong bg-paper px-3.5 text-[12px] font-medium text-ink-soft transition hover:bg-sunken disabled:opacity-60"
                    >
                      <Pencil className="size-3.5" strokeWidth={1.75} />
                      {editingThis ? "در حال ویرایش" : "ویرایش"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void deleteChore(chore.id, chore.title)}
                      aria-label="حذف"
                      className="inline-flex size-8 items-center justify-center rounded-full text-muted transition hover:bg-danger-soft hover:text-danger-ink disabled:opacity-60"
                    >
                      <Trash2 className="size-4" strokeWidth={1.75} />
                    </button>
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
