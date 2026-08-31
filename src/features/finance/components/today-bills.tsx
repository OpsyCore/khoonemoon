"use client";

import { Check, Loader2, Receipt } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { buildPayAction } from "@/features/finance/components/finance-payload";
import { toFinanceAmount } from "@/features/finance/status";
import type { TodayBillItem } from "@/features/finance/types";
import { Badge } from "@/shared/ui/badge";
import { SectionLabel } from "@/shared/ui/section-label";
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
      <li className="flex items-start gap-3 px-4 py-3.5">
        <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-soft">
          <Receipt className="size-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1 break-words">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-ink">{item.title}</p>
            {item.overdue ? (
              <Badge tone="danger">معوق</Badge>
            ) : (
              <Badge tone="warning">امروز</Badge>
            )}
          </div>
          <p className="mt-0.5 text-[13px] text-ink-soft">
            {formatAmount(item.amount, item.currency)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted">
            سررسید: {formatJalaliLongDate(due)} — {formatPersianTime(due)}
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          aria-busy={busy}
          onClick={() => void pay(item)}
          className="mt-0.5 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-olive px-3.5 text-[12px] font-medium text-cream transition hover:bg-olive-deep disabled:opacity-60 dark:text-[#221c14]"
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Check className="size-3.5" strokeWidth={2} />
          )}
          پرداخت
        </button>
      </li>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <SectionLabel className="min-w-0 flex-1">قبض‌ها</SectionLabel>
        <Link
          href="/finance"
          className="shrink-0 text-[12px] font-medium text-clay-ink transition hover:opacity-80"
        >
          همه مالی
        </Link>
      </div>

      {errorMessage ? (
        <p className="rounded-field border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger-ink">
          {errorMessage}
        </p>
      ) : null}

      {visibleItems.length === 0 ? (
        <p className="rounded-field border border-dashed border-line-strong/70 px-4 py-4 text-center text-[13px] text-muted">
          قبض سررسید یا معوقی ندارید — همه‌چیز پرداخت‌شده است.
        </p>
      ) : (
        <div className="space-y-3">
          {overdue.length > 0 ? (
            <ul className="divide-y divide-line rounded-card border border-line bg-card shadow-paper">
              {overdue.map((item) => (
                <Row key={item.id} item={item} />
              ))}
            </ul>
          ) : null}

          {dueToday.length > 0 ? (
            <ul className="divide-y divide-line rounded-card border border-line bg-card shadow-paper">
              {dueToday.map((item) => (
                <Row key={item.id} item={item} />
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </section>
  );
}
