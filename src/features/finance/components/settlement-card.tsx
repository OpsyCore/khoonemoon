import { HandCoins, Scale } from "lucide-react";
import { formatAmount } from "@/features/finance/bills";
import {
  settleHousehold,
  type SettlementMember,
} from "@/features/finance/settlement";
import type { FinancialRecord } from "@/features/finance/types";
import { Badge } from "@/shared/ui/badge";
import { Card, CardDescription, CardTitle } from "@/shared/ui/card";

/**
 * Shows who owes whom after the shared expenses of the household are netted.
 * Rendering-only: all the math lives in `settleHousehold` so it stays testable.
 */
export function SettlementCard({
  records,
  members,
  currentUserId,
}: {
  records: FinancialRecord[];
  members: SettlementMember[];
  currentUserId: string;
}) {
  const settlement = settleHousehold({ records, members });

  if (settlement.total === 0) {
    return (
      <Card className="space-y-2">
        <div className="flex items-center gap-2">
          <Scale className="size-4 text-zinc-500" />
          <CardTitle>تسویه‌حساب خانه</CardTitle>
        </div>
        <p className="text-sm text-ink-soft">
          هنوز خرج مشترکی که پرداخت‌شده باشد ثبت نشده است. وقتی هزینه‌ای را
          «مشترک خانه» ثبت کنید و پرداختش را علامت بزنید، سهم هر نفر همین‌جا
          محاسبه می‌شود.
        </p>
      </Card>
    );
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Scale className="size-4 text-zinc-500" />
          <CardTitle>تسویه‌حساب خانه</CardTitle>
        </div>
        <Badge tone="neutral">مجموع {formatAmount(settlement.total)}</Badge>
      </div>

      <CardDescription>
        خرج‌های مشترک بین {settlement.balances.length} عضو مساوی تقسیم شده است.
      </CardDescription>

      <ul className="space-y-1.5">
        {settlement.balances.map((entry) => {
          const isCurrentUser = entry.memberId === currentUserId;
          const tone =
            entry.balance > 0
              ? ("success" as const)
              : entry.balance < 0
                ? ("danger" as const)
                : ("neutral" as const);
          const label =
            entry.balance > 0
              ? "طلبکار"
              : entry.balance < 0
                ? "بدهکار"
                : "تسویه";

          return (
            <li
              key={entry.memberId}
              className="flex items-center justify-between gap-2 rounded-xl bg-sunken px-3 py-2 text-sm"
            >
              <span className="truncate">
                {entry.name}
                {isCurrentUser ? (
                  <span className="text-xs text-zinc-500"> (شما)</span>
                ) : null}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <Badge tone={tone}>{label}</Badge>
                <span className="tabular-nums text-ink-soft">
                  {formatAmount(Math.abs(entry.balance))}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      <div className="space-y-2 border-t border-line pt-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <HandCoins className="size-4 text-zinc-500" />
          {settlement.isSettled ? "همه‌چیز تسویه است" : "پیشنهاد تسویه"}
        </div>

        {settlement.isSettled ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-300">
            کسی به کسی بدهکار نیست. 🎉
          </p>
        ) : (
          <ul className="space-y-1.5">
            {settlement.transfers.map((transfer) => (
              <li
                key={`${transfer.fromId}-${transfer.toId}`}
                className="rounded-xl bg-olive-soft px-3 py-2 text-sm text-olive-ink"
              >
                <span className="font-medium">{transfer.fromName}</span> به{" "}
                <span className="font-medium">{transfer.toName}</span> مبلغ{" "}
                <span className="tabular-nums">
                  {formatAmount(transfer.amount)}
                </span>{" "}
                بدهکار است.
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
