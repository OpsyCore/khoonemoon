import { TrendingUp } from "lucide-react";
import { buildFinanceAnalytics } from "@/features/finance/analytics";
import { formatAmount } from "@/features/finance/bills";
import type { FinancialRecord } from "@/features/finance/types";
import { Card, CardDescription, CardTitle } from "@/shared/ui/card";
import { toPersianNumber } from "@/shared/utils/locale";

const CHART_HEIGHT = 120;
const CHART_PADDING = 8;

/**
 * Monthly income/expense chart and category split, drawn with plain SVG.
 *
 * No chart library on purpose: the whole point is a readable trend, and adding
 * recharts/d3 would cost hundreds of kilobytes in a mobile-first PWA.
 */
export function FinanceCharts({
  records,
  now,
  months = 6,
}: {
  records: FinancialRecord[];
  now: Date;
  months?: number;
}) {
  const analytics = buildFinanceAnalytics({ records, now, months });

  if (!analytics.hasData) {
    return (
      <Card className="space-y-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-zinc-500" />
          <CardTitle>روند مالی</CardTitle>
        </div>
        <p className="text-sm text-ink-soft">
          هنوز داده‌ای برای نمودار نیست. با ثبت هزینه یا درآمد، روند ۶ ماه گذشته
          همین‌جا ساخته می‌شود.
        </p>
      </Card>
    );
  }

  const peak = analytics.peak || 1;
  const columnWidth = 100 / analytics.months.length;
  const barWidth = columnWidth * 0.28;

  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-zinc-500" />
          <CardTitle>روند مالی</CardTitle>
        </div>
        <span className="text-xs text-muted">
          {toPersianNumber(months)} ماه گذشته
        </span>
      </div>

      <CardDescription>
        هر ماه دو ستون دارد: سبز درآمد، کهربایی هزینه. مقیاس بر اساس بیشترین
        مبلغ ماه است و با اعداد تومان خوانده می‌شود.
      </CardDescription>

      <svg
        role="img"
        aria-label="نمودار درآمد و هزینه ماه‌های گذشته"
        viewBox={`0 0 100 ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        className="h-32 w-full"
      >
        <line
          x1="0"
          y1={CHART_HEIGHT - CHART_PADDING}
          x2="100"
          y2={CHART_HEIGHT - CHART_PADDING}
          className="stroke-zinc-200 dark:stroke-zinc-800"
          strokeWidth="0.4"
        />

        {analytics.months.map((point, index) => {
          const center = columnWidth * index + columnWidth / 2;
          const usable = CHART_HEIGHT - CHART_PADDING * 2;

          const incomeHeight = (point.income / peak) * usable;
          const expenseHeight = (point.expense / peak) * usable;

          return (
            <g key={point.key}>
              <rect
                x={center - barWidth - 0.6}
                y={CHART_HEIGHT - CHART_PADDING - incomeHeight}
                width={barWidth}
                height={incomeHeight}
                rx="0.8"
                className="fill-emerald-500"
              >
                <title>
                  {`${point.label} — درآمد ${formatAmount(point.income)}`}
                </title>
              </rect>
              <rect
                x={center + 0.6}
                y={CHART_HEIGHT - CHART_PADDING - expenseHeight}
                width={barWidth}
                height={expenseHeight}
                rx="0.8"
                className="fill-amber-500"
              >
                <title>
                  {`${point.label} — هزینه ${formatAmount(point.expense)}`}
                </title>
              </rect>
            </g>
          );
        })}
      </svg>

      <ul className="grid grid-cols-3 gap-1 text-center text-[11px] text-muted">
        {analytics.months.map((point) => (
          <li key={point.key} className="truncate">
            {point.label}
          </li>
        ))}
      </ul>

      {analytics.categories.length > 0 ? (
        <div className="space-y-2 border-t border-line pt-3">
          <p className="text-sm font-medium">سهم دسته‌ها</p>
          <ul className="space-y-2">
            {analytics.categories.slice(0, 6).map((slice) => (
              <li key={slice.category} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate">{slice.category}</span>
                  <span className="shrink-0 tabular-nums text-muted">
                    {formatAmount(slice.total)} · {toPersianNumber(slice.share)}
                    ٪
                  </span>
                </div>
                <div
                  role="presentation"
                  className="h-1.5 w-full overflow-hidden rounded-full bg-sunken"
                >
                  <div
                    className="h-full rounded-full bg-olive"
                    style={{ width: `${slice.share}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
