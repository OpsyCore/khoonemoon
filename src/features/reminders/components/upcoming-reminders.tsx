"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ReminderRecord } from "@/features/reminders/types";
import { Button } from "@/shared/ui/button";
import { Card, CardDescription, CardTitle } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { formatJalaliLongDate } from "@/shared/utils/jalali";
import { formatPersianTime } from "@/shared/utils/locale";

export function UpcomingReminders({
  reminders,
}: {
  reminders: ReminderRecord[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const snooze = async (id: string, minutes: number) => {
    setError(null);

    const response = await fetch(`/api/reminders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "snooze", minutes }),
    });

    if (!response.ok) {
      setError("تعویق یادآور ناموفق بود.");
      return;
    }

    router.refresh();
  };

  const cancel = async (id: string) => {
    setError(null);

    const response = await fetch(`/api/reminders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });

    if (!response.ok) {
      setError("لغو یادآور ناموفق بود.");
      return;
    }

    router.refresh();
  };

  return (
    <Card className="space-y-3">
      <CardTitle>یادآورهای آینده نزدیک</CardTitle>
      <CardDescription>
        نمایش تا ۷۲ ساعت آینده بر اساس منطقه زمانی فعلی شما.
      </CardDescription>

      {reminders.length === 0 ? (
        <EmptyState
          title="یادآور فعالی ندارید"
          description="برای تسک‌ها و رویدادها یادآور ثبت کنید."
        />
      ) : (
        <ul className="space-y-2">
          {reminders.map((reminder) => {
            const effectiveAt = reminder.snoozed_until ?? reminder.remind_at;
            const d = new Date(effectiveAt);

            return (
              <li
                key={reminder.id}
                className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-700"
              >
                <p className="text-sm font-semibold">
                  {reminder.target_type === "TASK"
                    ? "یادآور تسک"
                    : "یادآور رویداد"}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {formatJalaliLongDate(d)} - {formatPersianTime(d)}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  وضعیت: {reminder.status}
                </p>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => snooze(reminder.id, 10)}
                  >
                    تعویق ۱۰ دقیقه
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => cancel(reminder.id)}
                  >
                    لغو
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {error ? (
        <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
      ) : null}
    </Card>
  );
}
