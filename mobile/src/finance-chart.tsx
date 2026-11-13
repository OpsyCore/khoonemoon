import type { FinanceAnalytics } from "@/features/finance/analytics";
import { formatAmount } from "@/features/finance/bills";

/** Decorative bars are accompanied by the numeric table in the caller. */
export function FinanceChart({
  analytics,
  currency,
}: {
  analytics: FinanceAnalytics;
  currency: string;
}) {
  if (!analytics.months.length) return null;
  const peak = analytics.peak || 1;
  const column = 100 / analytics.months.length;
  return (
    <div className="finance-chart">
      <svg
        role="img"
        aria-label={`نمودار درآمد و هزینه شش ماه اخیر به ${currency}`}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <g transform="translate(100 0) scale(-1 1)">
          <line
            x1="0"
            y1="95"
            x2="100"
            y2="95"
            stroke="currentColor"
            strokeWidth="0.4"
          />
          {analytics.months.map((month, index) => {
            const income = (month.income / peak) * 90;
            const expense = (month.expense / peak) * 90;
            return (
              <g key={month.key}>
                <rect
                  x={index * column + column * 0.18}
                  y={95 - income}
                  width={column * 0.28}
                  height={income}
                  fill="#687d56"
                >
                  <title>{`${month.label}، درآمد ${formatAmount(month.income, currency)}`}</title>
                </rect>
                <rect
                  x={index * column + column * 0.54}
                  y={95 - expense}
                  width={column * 0.28}
                  height={expense}
                  fill="#d99a8c"
                >
                  <title>{`${month.label}، هزینه ${formatAmount(month.expense, currency)}`}</title>
                </rect>
              </g>
            );
          })}
        </g>
      </svg>
      <div className="finance-chart-months" aria-hidden="true">
        {analytics.months.map((month) => (
          <span key={month.key}>{month.label}</span>
        ))}
      </div>
    </div>
  );
}
