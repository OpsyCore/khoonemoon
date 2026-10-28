import { Receipt } from "lucide-react";
import { formatAmount, getBillStatus, isBillRecord } from "@/features/finance/bills";
import type { FinancialRecord } from "@/features/finance/types";
import { Badge } from "@/shared/ui/badge";
import { Card, CardDescription, CardTitle } from "@/shared/ui/card";
import { formatPersianDate } from "@/shared/utils/locale";

const STATUS_LABELS = {
  PAID: { label: "پرداخت‌شده", tone: "success" as const },
  OVERDUE: { label: "معوق", tone: "danger" as const },
  DUE: { label: "سررسید نزدیک", tone: "warning" as const },
  UPCOMING: { label: "پیش‌رو", tone: "neutral" as const },
};

export function UpcomingBills({ records }: { records: FinancialRecord[] }) {
  const now = new Date();

  const bills = records
    .filter((record) => isBillRecord(record) && !record.archived_at)
    .map((record) => ({
      record,
      status: getBillStatus({
        dueAt: record.due_at,
        paidAt: record.paid_at,
        now,
      }),
    }))
    .filter((item) => item.status !== "PAID")
    .sort((a, b) => (a.record.due_at ?? "").localeCompare(b.record.due_at ?? ""))
    .slice(0, 4);

  if (bills.length === 0) return null;

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <Receipt className="size-4 text-amber-600 dark:text-amber-400" />
        <CardTitle>قبض‌های پیش‌رو</CardTitle>
      </div>

      <ul className="space-y-2">
        {bills.map(({ record, status }) => (
          <li
            key={record.id}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <span className="text-zinc-800 dark:text-zinc-100">
              {record.title}
              <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                {formatAmount(record.amount, record.currency)}
                {record.due_at ? ` · ${formatPersianDate(record.due_at)}` : ""}
              </span>
            </span>
            <Badge tone={STATUS_LABELS[status].tone}>
              {STATUS_LABELS[status].label}
            </Badge>
          </li>
        ))}
      </ul>

      <CardDescription>
        برای ثبت پرداخت به تب «مالی» در صفحه لیست‌ها بروید.
      </CardDescription>
    </Card>
  );
}
