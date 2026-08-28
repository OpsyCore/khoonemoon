"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { buildPayAction } from "@/features/finance/components/finance-payload";
import { toFinanceAmount } from "@/features/finance/status";
import type { TodayBillItem } from "@/features/finance/types";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardDescription, CardTitle } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { formatJalaliLongDate } from "@/shared/utils/jalali";
import { formatPersianTime, toPersianNumber } from "@/shared/utils/locale";

function formatAmount(amount: number, currency: string) {
  return `${toPersianNumber(toFinanceAmount(amount))} ${currency}`;
}

export function TodayBills({ items }: { items: TodayBillItem[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [paidIds, setPaidIds] = useState<string[]>([]);

  const visibleItems = useMemo(
    () => items.filter((item) => !paidIds.includes(item.id)),
    [items, paidIds],
  );
  const overdue = visibleItems.filter((item) => item.overdue);
  const dueToday = visibleItems.filter((item) => !item.overdue);

  async function pay(item: TodayBillItem) {
    if (pendingId) return;
    setPendingId(item.id);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/finance/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayAction()),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "ثبت پرداخت ناموفق بود.");
      }
      setPaidIds((current) =>
        current.includes(item.id) ? current : [...current, item.id],
      );
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "ثبت پرداخت ناموفق بود.",
      );
    } finally {
      setPendingId(null);
    }
  }

  function Row({ item }: { item: TodayBillItem }) {
    const busy = pendingId === item.id;
    const due = new Date(item.dueAt);

    return (
      <li>
        <Card className="min-w-0 space-y-3">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1 break-words">
              <CardTitle>{item.title}</CardTitle>
              <CardDescription>
                {formatAmount(item.amount, item.currency)}
              </CardDescription>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                سررسید: {formatJalaliLongDate(due)} — {formatPersianTime(due)}
              </p>
            </div>
            {item.overdue ? (
              <Badge tone="danger">معوق</Badge>
            ) : (
              <Badge tone="warning">امروز</Badge>
            )}
          </div>
          <Button
            type="button"
            size="sm"
            disabled={busy}
            aria-busy={busy}
            onClick={() => void pay(item)}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            پرداخت
          </Button>
        </Card>
      </li>
    );
  }

  if (visibleItems.length === 0) {
    return (
      <section className="space-y-3">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          قبض‌ها
        </h3>
        <EmptyState
          title="قبض سررسید یا معوقی ندارید"
          description="قبض‌های پرداخت‌نشدهٔ امروز و معوق اینجا دیده می‌شوند."
        />
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          قبض‌ها
        </h3>
        <div className="flex flex-wrap gap-2 text-xs">
          {overdue.length > 0 ? (
            <Badge tone="danger">{overdue.length} معوق</Badge>
          ) : null}
          <Badge tone="info">{dueToday.length} امروز</Badge>
        </div>
      </div>

      {errorMessage ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          {errorMessage}
        </p>
      ) : null}

      {overdue.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-rose-600 dark:text-rose-300">
            معوق
          </p>
          <ul className="space-y-2">
            {overdue.map((item) => (
              <Row key={item.id} item={item} />
            ))}
          </ul>
        </div>
      ) : null}

      {dueToday.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-sky-700 dark:text-sky-300">
            سررسید امروز
          </p>
          <ul className="space-y-2">
            {dueToday.map((item) => (
              <Row key={item.id} item={item} />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
