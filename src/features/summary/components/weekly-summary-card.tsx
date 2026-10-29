import { CalendarCheck } from "lucide-react";

import { formatAmount } from "@/features/finance/bills";
import type { WeeklySummary } from "@/features/summary/weekly-summary";
import { Card, CardDescription, CardTitle } from "@/shared/ui/card";
import { toPersianNumber } from "@/shared/utils/locale";

function comparisonLine({
  current,
  previous,
  unit,
}: {
  current: number;
  previous: number;
  unit: string;
}) {
  if (current === 0 && previous === 0) {
    return "هفتهٔ قبل هم چیزی ثبت نشد.";
  }

  if (previous === 0) {
    return "هفتهٔ قبل چیزی ثبت نشده بود، پس مقایسه‌ای در کار نیست.";
  }

  const difference = current - previous;

  if (difference === 0) {
    return `دقیقاً مثل هفتهٔ قبل (${toPersianNumber(previous)} ${unit}).`;
  }

  const direction = difference > 0 ? "بیشتر" : "کمتر";
  return `${toPersianNumber(Math.abs(difference))} ${unit} ${direction} از هفتهٔ قبل.`;
}

/**
 * A seven-day recap, rendered on the server.
 *
 * Deliberately a server component: the Today page is already the heaviest route
 * in the bundle, and this is read-only arithmetic — shipping it to the client to
 * re-derive the same numbers would cost every visitor for no benefit.
 */
export function WeeklySummaryCard({ summary }: { summary: WeeklySummary }) {
  const nothingHappened =
    summary.tasksDone === 0 &&
    summary.choresDone === 0 &&
    summary.spent === 0 &&
    summary.earned === 0;

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <CalendarCheck className="size-4 text-sky-600 dark:text-sky-400" />
        <CardTitle>این هفته</CardTitle>
      </div>

      {nothingHappened ? (
        <CardDescription>
          هنوز در هفت روز گذشته چیزی ثبت نشده. با یک کار کوچک شروع کنید.
        </CardDescription>
      ) : (
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-zinc-50 p-3 dark:bg-zinc-800/50">
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">کارها</dt>
            <dd className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">
              {toPersianNumber(summary.tasksDone)} انجام‌شده
            </dd>
            <dd className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {comparisonLine({
                current: summary.tasksDone,
                previous: summary.tasksDonePrevious,
                unit: "کار",
              })}
            </dd>
          </div>

          <div className="rounded-2xl bg-zinc-50 p-3 dark:bg-zinc-800/50">
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">
              کارهای خانه
            </dt>
            <dd className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">
              {toPersianNumber(summary.choresDone)} انجام‌شده
            </dd>
            <dd className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {comparisonLine({
                current: summary.choresDone,
                previous: summary.choresDonePrevious,
                unit: "نوبت",
              })}
            </dd>
          </div>

          <div className="rounded-2xl bg-zinc-50 p-3 dark:bg-zinc-800/50">
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">خرج</dt>
            <dd className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">
              {formatAmount(summary.spent)}
            </dd>
            <dd className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {summary.spentChange === null
                ? "هفتهٔ قبل خرجی ثبت نشده بود."
                : summary.spentChange === 0
                  ? "به اندازهٔ هفتهٔ قبل."
                  : `${toPersianNumber(Math.abs(summary.spentChange))}٪ ${summary.spentChange > 0 ? "بیشتر" : "کمتر"} از هفتهٔ قبل.`}
            </dd>
          </div>

          <div className="rounded-2xl bg-zinc-50 p-3 dark:bg-zinc-800/50">
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">درآمد</dt>
            <dd className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">
              {formatAmount(summary.earned)}
            </dd>
            <dd className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {summary.earned > 0
                ? "در هفت روز گذشته ثبت شده است."
                : "درآمدی در این هفته ثبت نشده."}
            </dd>
          </div>
        </dl>
      )}
    </Card>
  );
}
