import { AlarmClock, BellRing, CalendarClock, CheckCheck } from "lucide-react";
import {
  daysUntil,
  isRepeatedlySnoozed,
  type InboxEntry,
  type ReminderInbox as ReminderInboxModel,
  type ReminderState,
} from "@/features/reminders/inbox";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardDescription, CardTitle } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { formatJalaliLongDate } from "@/shared/utils/jalali";
import { formatPersianTime, toPersianNumber } from "@/shared/utils/locale";

const STATE_META: Record<
  ReminderState,
  {
    label: string;
    tone: "danger" | "warning" | "neutral" | "success";
    hint: string;
  }
> = {
  DUE: {
    label: "رسیده",
    tone: "danger",
    hint: "زمانش گذشته و هنوز تحویل نشده؛ اگر لازم نیست لغو کنید.",
  },
  TODAY: { label: "امروز", tone: "warning", hint: "امروز سر می‌رسد." },
  UPCOMING: { label: "پیش‌رو", tone: "neutral", hint: "روزهای آینده." },
  DELIVERED: {
    label: "تحویل‌شده",
    tone: "success",
    hint: "به شما اطلاع داده شده است.",
  },
  CANCELED: { label: "لغو‌شده", tone: "neutral", hint: "خودتان لغو کرده‌اید." },
};

export type ReminderAction = "snooze-10" | "snooze-60" | "cancel";

function relativeHint(entry: InboxEntry, now: Date) {
  const days = daysUntil({ iso: entry.effectiveAt, now });

  if (days === null) return "";
  if (days === 0) return "امروز";
  if (days === 1) return "فردا";
  if (days > 1) return `${toPersianNumber(days)} روز دیگر`;
  if (days === -1) return "دیروز";
  return `${toPersianNumber(Math.abs(days))} روز پیش`;
}

/**
 * Presentation only: no hooks, no router, no state. The client wrapper
 * (`reminder-inbox.tsx`) owns the actions, which keeps this testable with a plain
 * `renderToStaticMarkup` and keeps the layout logic readable.
 */
export function ReminderInboxView({
  inbox,
  now,
  hasReminders,
  busyId = null,
  error = null,
  onAction,
}: {
  inbox: ReminderInboxModel;
  now: Date;
  hasReminders: boolean;
  busyId?: string | null;
  error?: string | null;
  onAction?: (id: string, action: ReminderAction) => void;
}) {
  if (!hasReminders) {
    return (
      <EmptyState
        title="صندوق یادآورها خالی است"
        description="وقتی برای تسک یا رویدادی یادآور بسازید، اینجا همه‌شان — گذشته و آینده — یک‌جا دیده می‌شوند."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Card className="space-y-1 p-3">
          <p className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
            <BellRing className="size-3" />
            رسیده
          </p>
          <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">
            {toPersianNumber(inbox.counts.due)}
          </p>
        </Card>

        <Card className="space-y-1 p-3">
          <p className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
            <AlarmClock className="size-3" />
            امروز
          </p>
          <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
            {toPersianNumber(inbox.counts.today)}
          </p>
        </Card>

        <Card className="space-y-1 p-3">
          <p className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
            <CheckCheck className="size-3" />
            تحویل‌شده
          </p>
          <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            {toPersianNumber(inbox.counts.delivered)}
          </p>
        </Card>
      </div>

      {error ? (
        <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
      ) : null}

      {inbox.sections.map((section) => {
        const meta = STATE_META[section.state];
        const isActionable =
          section.state === "DUE" || section.state === "TODAY";

        return (
          <Card key={section.state} className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarClock className="size-4 text-zinc-500" />
                <CardTitle>{meta.label}</CardTitle>
              </div>
              <Badge tone={meta.tone}>
                {toPersianNumber(section.entries.length)} مورد
              </Badge>
            </div>

            <CardDescription>{meta.hint}</CardDescription>

            <ul className="space-y-2">
              {section.entries.map((entry) => {
                const date = new Date(entry.effectiveAt);

                return (
                  <li
                    key={entry.id}
                    className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-700"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-0.5">
                        <p className="truncate text-sm font-semibold">
                          {entry.title}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {entry.targetType === "TASK" ? "تسک" : "رویداد"}
                          {" · "}
                          {formatJalaliLongDate(date)} —{" "}
                          {formatPersianTime(date)}
                          {" · "}
                          {relativeHint(entry, now)}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {isRepeatedlySnoozed(entry) ? (
                          <Badge tone="warning">
                            {toPersianNumber(entry.snoozeCount)} بار تعویق
                          </Badge>
                        ) : null}
                        {entry.status === "SNOOZED" ? (
                          <Badge tone="neutral">به تعویق افتاده</Badge>
                        ) : null}
                      </div>
                    </div>

                    {isActionable && onAction ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          isLoading={busyId === entry.id}
                          onClick={() => onAction(entry.id, "snooze-10")}
                        >
                          تعویق ۱۰ دقیقه
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onAction(entry.id, "snooze-60")}
                        >
                          تعویق ۱ ساعت
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => onAction(entry.id, "cancel")}
                        >
                          لغو
                        </Button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
