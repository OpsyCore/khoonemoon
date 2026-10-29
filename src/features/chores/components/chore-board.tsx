"use client";

import { Check, Plus, Repeat, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ChoreActions } from "@/features/chores/components/chore-actions";
import { ChoreHistory } from "@/features/chores/components/chore-history";
import {
  getChoreState,
  resolveCurrentAssignee,
} from "@/features/chores/rotation";
import type { ChoreCompletion, ChoreRecord } from "@/features/chores/types";
import type { TaskMember } from "@/features/tasks/types";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardDescription, CardTitle } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { Input } from "@/shared/ui/input";
import { formatPersianDate } from "@/shared/utils/locale";

const STATE_LABELS = {
  OVERDUE: { label: "عقب‌افتاده", tone: "danger" as const },
  DUE_TODAY: { label: "امروز", tone: "warning" as const },
  UPCOMING: { label: "پیش‌رو", tone: "neutral" as const },
  PAUSED: { label: "متوقف", tone: "neutral" as const },
  UNSCHEDULED: { label: "بدون زمان", tone: "neutral" as const },
};

const FREQUENCY_LABELS: Record<string, string> = {
  NONE: "بدون تکرار",
  DAILY: "هر روز",
  WEEKLY: "هفتگی",
  MONTHLY: "ماهانه",
  YEARLY: "سالانه",
  INTERVAL_DAYS: "هر چند روز",
};

export function ChoreBoard({
  chores,
  completions,
  members,
  canManage,
}: {
  chores: ChoreRecord[];
  completions: ChoreCompletion[];
  members: TaskMember[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [rotationMode, setRotationMode] = useState<"FIXED" | "ROTATING">(
    members.length > 1 ? "ROTATING" : "FIXED",
  );
  const [frequency, setFrequency] = useState("WEEKLY");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyChoreId, setBusyChoreId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const memberNames = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((member) => map.set(member.user_id, member.full_name));
    return map;
  }, [members]);

  const sortedChores = useMemo(() => {
    const now = new Date();
    const order = {
      OVERDUE: 0,
      DUE_TODAY: 1,
      UPCOMING: 2,
      UNSCHEDULED: 3,
      PAUSED: 4,
    };

    return [...chores].sort(
      (a, b) =>
        order[
          getChoreState({
            nextDueAt: a.next_due_at,
            isActive: a.is_active,
            now,
          })
        ] -
        order[
          getChoreState({
            nextDueAt: b.next_due_at,
            isActive: b.is_active,
            now,
          })
        ],
    );
  }, [chores]);

  const createChore = async () => {
    if (title.trim().length < 2) {
      setMessage("عنوان کار خانه را وارد کنید.");
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    const response = await fetch("/api/chores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        rotationMode,
        frequency,
        assigneeIds: members.map((member) => member.user_id),
      }),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      setMessage(payload?.message ?? "ایجاد کار خانه ناموفق بود.");
      return;
    }

    setTitle("");
    router.refresh();
  };

  const completeChore = async (chore: ChoreRecord) => {
    setBusyChoreId(chore.id);
    setMessage(null);

    const response = await fetch(`/api/chores/${chore.id}/complete`, {
      method: "POST",
    });

    setBusyChoreId(null);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      setMessage(payload?.message ?? "ثبت انجام کار ناموفق بود.");
      return;
    }

    router.refresh();
  };

  const toggleActive = async (chore: ChoreRecord) => {
    setBusyChoreId(chore.id);

    await fetch(`/api/chores/${chore.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !chore.is_active }),
    });

    setBusyChoreId(null);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {canManage ? (
        <Card className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-sky-600 dark:text-sky-400" />
            <CardTitle>کار خانه جدید</CardTitle>
          </div>

          <Input
            aria-label="عنوان کار خانه"
            placeholder="مثلاً: شستن ظرف‌ها"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />

          <div className="flex flex-wrap gap-2">
            {["DAILY", "WEEKLY", "MONTHLY"].map((option) => (
              <Button
                key={option}
                size="sm"
                variant={frequency === option ? "secondary" : "ghost"}
                onClick={() => setFrequency(option)}
              >
                {FREQUENCY_LABELS[option]}
              </Button>
            ))}

            {members.length > 1 ? (
              <Button
                size="sm"
                variant={rotationMode === "ROTATING" ? "secondary" : "ghost"}
                onClick={() =>
                  setRotationMode(
                    rotationMode === "ROTATING" ? "FIXED" : "ROTATING",
                  )
                }
              >
                <Repeat className="size-3" />
                نوبتی
              </Button>
            ) : null}
          </div>

          <Button
            className="w-full"
            onClick={() => void createChore()}
            isLoading={isSubmitting}
          >
            <Plus className="size-4" />
            افزودن کار خانه
          </Button>

          {message ? (
            <p className="text-xs text-rose-600 dark:text-rose-400">
              {message}
            </p>
          ) : null}
        </Card>
      ) : null}

      {sortedChores.length === 0 ? (
        <EmptyState
          title="هنوز کار خانه‌ای ثبت نشده"
          description="کارهای تکرارشونده مثل ظرف شستن یا خرید نان را اضافه کنید تا نوبت‌ها خودکار بچرخد."
        />
      ) : (
        <ul className="space-y-2">
          {sortedChores.map((chore) => {
            const state = getChoreState({
              nextDueAt: chore.next_due_at,
              isActive: chore.is_active,
              now: new Date(),
            });
            const assigneeId = resolveCurrentAssignee({
              rotationMode: chore.rotation_mode,
              currentRotationIndex: chore.current_rotation_index,
              steps: chore.chore_rotation_steps ?? [],
            });

            return (
              <li key={chore.id}>
                <Card className="space-y-3 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {chore.title}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {FREQUENCY_LABELS[chore.frequency] ?? chore.frequency}
                        {assigneeId
                          ? ` · نوبت ${memberNames.get(assigneeId) ?? "کاربر"}`
                          : ""}
                        {chore.next_due_at
                          ? ` · ${formatPersianDate(chore.next_due_at)}`
                          : ""}
                      </p>
                    </div>

                    <Badge tone={STATE_LABELS[state].tone}>
                      {STATE_LABELS[state].label}
                    </Badge>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => void completeChore(chore)}
                      isLoading={busyChoreId === chore.id}
                    >
                      <Check className="size-4" />
                      انجام شد
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void toggleActive(chore)}
                    >
                      {chore.is_active ? "توقف" : "فعال‌سازی"}
                    </Button>
                  </div>

                  <ChoreActions
                    chore={chore}
                    memberCount={members.length}
                    canManage={canManage}
                  />
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <ChoreHistory
        completions={completions}
        chores={chores}
        members={members}
      />
    </div>
  );
}
