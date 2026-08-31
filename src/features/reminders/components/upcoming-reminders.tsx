"use client";

import { BellRing, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ReminderRecord } from "@/features/reminders/types";
import { SectionLabel } from "@/shared/ui/section-label";
import { formatJalaliLongDate } from "@/shared/utils/jalali";
import { formatPersianTime } from "@/shared/utils/locale";

const statusLabels: Record<string, string> = {
  PENDING: "در انتظار",
  SNOOZED: "به تعویق افتاده",
  DELIVERED: "ارسال‌شده",
  CANCELLED: "لغوشده",
};

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
    <section className="space-y-3">
      <SectionLabel>یادآورهای پیش‌رو</SectionLabel>

      {reminders.length === 0 ? (
        <p className="rounded-field border border-dashed border-line-strong/70 px-4 py-4 text-center text-[13px] text-muted">
          یادآور فعالی تا ۷۲ ساعت آینده ندارید.
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-card border border-line bg-card shadow-paper">
          {reminders.map((reminder) => {
            const effectiveAt = reminder.snoozed_until ?? reminder.remind_at;
            const d = new Date(effectiveAt);

            return (
              <li
                key={reminder.id}
                className="flex items-start gap-3 px-4 py-3.5"
              >
                <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-warn-soft text-warn-ink">
                  <BellRing className="size-4" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">
                    {reminder.target_type === "TASK"
                      ? "یادآور تسک"
                      : "یادآور رویداد"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {formatJalaliLongDate(d)} — {formatPersianTime(d)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    وضعیت: {statusLabels[reminder.status] ?? reminder.status}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => snooze(reminder.id, 10)}
                    className="inline-flex h-7 items-center rounded-full border border-line-strong bg-paper px-2.5 text-[11px] font-medium text-ink-soft transition hover:bg-sunken"
                  >
                    ۱۰ دقیقه بعد
                  </button>
                  <button
                    type="button"
                    onClick={() => cancel(reminder.id)}
                    aria-label="لغو یادآور"
                    className="inline-flex size-7 items-center justify-center rounded-full text-muted transition hover:bg-danger-soft hover:text-danger-ink"
                  >
                    <X className="size-3.5" strokeWidth={1.75} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {error ? <p className="text-sm text-danger-ink">{error}</p> : null}
    </section>
  );
}
