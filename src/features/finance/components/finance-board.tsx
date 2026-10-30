"use client";

import { Backpack, Plus, Receipt, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  formatAmount,
  getBillStatus,
  isBillRecord,
  summarizeFinance,
} from "@/features/finance/bills";
import type {
  FinancialRecord,
  FinancialRecordType,
} from "@/features/finance/types";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { FinanceRecordActions } from "@/features/finance/components/finance-record-actions";
import { Card, CardDescription, CardTitle } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { Input } from "@/shared/ui/input";
import { formatPersianDate } from "@/shared/utils/locale";

const TYPE_LABELS: Record<FinancialRecordType, string> = {
  EXPENSE: "هزینه",
  INCOME: "درآمد",
  BILL: "قبض",
  SUBSCRIPTION: "اشتراک",
  INSTALLMENT: "قسط",
  DEBT: "بدهی",
};

const STATUS_LABELS = {
  PAID: { label: "پرداخت‌شده", tone: "success" as const },
  OVERDUE: { label: "معوق", tone: "danger" as const },
  DUE: { label: "سررسید نزدیک", tone: "warning" as const },
  UPCOMING: { label: "پیش‌رو", tone: "neutral" as const },
};

export function FinanceBoard({
  records,
  canShare,
}: {
  records: FinancialRecord[];
  canShare: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [recordType, setRecordType] = useState<FinancialRecordType>("BILL");
  const [dueAt, setDueAt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const now = new Date();
  const summary = useMemo(
    () => summarizeFinance(records, new Date()),
    [records],
  );

  const createRecord = async () => {
    const parsedAmount = Number(amount.replace(/[,٬\s]/g, ""));

    if (title.trim().length < 2 || !Number.isFinite(parsedAmount)) {
      setMessage("عنوان و مبلغ را کامل وارد کنید.");
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    const response = await fetch("/api/finance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        amount: parsedAmount,
        recordType,
        visibility: canShare ? "HOUSEHOLD_SHARED" : "PRIVATE",
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      }),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      setMessage(payload?.message ?? "ثبت رکورد مالی ناموفق بود.");
      return;
    }

    setTitle("");
    setAmount("");
    setDueAt("");
    router.refresh();
  };

  const markPaid = async (record: FinancialRecord) => {
    const response = await fetch(`/api/finance/${record.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paid: !record.paid_at }),
    });

    if (!response.ok) {
      setMessage("تغییر وضعیت پرداخت ناموفق بود.");
      return;
    }

    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Card className="space-y-1 p-3">
          <p className="flex items-center gap-1 text-xs text-muted">
            <Wallet className="size-3" />
            درآمد
          </p>
          <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            {formatAmount(summary.income)}
          </p>
        </Card>

        <Card className="space-y-1 p-3">
          <p className="flex items-center gap-1 text-xs text-muted">
            <Backpack className="size-3" />
            هزینه
          </p>
          <p className="text-sm font-semibold text-ink">
            {formatAmount(summary.expense)}
          </p>
        </Card>

        <Card className="space-y-1 p-3">
          <p className="flex items-center gap-1 text-xs text-muted">
            <Receipt className="size-3" />
            مانده قبض
          </p>
          <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
            {formatAmount(summary.outstanding)}
          </p>
        </Card>
      </div>

      <Card className="space-y-3">
        <CardTitle>ثبت قبض یا هزینه</CardTitle>
        <CardDescription>
          قبض‌های سررسیدشده در داشبورد «امروز» هم نمایش داده می‌شوند.
        </CardDescription>

        <Input
          aria-label="عنوان"
          placeholder="مثلاً: قبض برق"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />

        <Input
          aria-label="مبلغ"
          inputMode="numeric"
          placeholder="مبلغ (ریال)"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />

        <div className="flex flex-wrap gap-2">
          {(["BILL", "EXPENSE", "INCOME", "INSTALLMENT"] as const).map(
            (option) => (
              <Button
                key={option}
                size="sm"
                variant={recordType === option ? "secondary" : "ghost"}
                onClick={() => setRecordType(option)}
              >
                {TYPE_LABELS[option]}
              </Button>
            ),
          )}
        </div>

        <Input
          aria-label="سررسید"
          type="datetime-local"
          value={dueAt}
          onChange={(event) => setDueAt(event.target.value)}
        />

        <Button
          className="w-full"
          onClick={() => void createRecord()}
          isLoading={isSubmitting}
        >
          <Plus className="size-4" />
          ثبت
        </Button>

        {message ? (
          <p className="text-xs text-rose-600 dark:text-rose-400">{message}</p>
        ) : null}
      </Card>

      {records.length === 0 ? (
        <EmptyState
          title="هنوز رکورد مالی ثبت نشده"
          description="با ثبت قبض‌ها، وضعیت پرداخت و مبلغ باقی‌مانده محاسبه می‌شود."
        />
      ) : (
        <ul className="space-y-2">
          {records.map((record) => {
            const status = isBillRecord(record)
              ? getBillStatus({
                  dueAt: record.due_at,
                  paidAt: record.paid_at,
                  now,
                })
              : null;

            return (
              <li key={record.id}>
                <Card className="flex items-start justify-between gap-3 p-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-ink">
                      {record.title}
                    </p>
                    <p className="text-xs text-muted">
                      {TYPE_LABELS[record.record_type]} ·{" "}
                      {formatAmount(record.amount, record.currency)}
                      {record.due_at
                        ? ` · ${formatPersianDate(record.due_at)}`
                        : ""}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {status ? (
                      <Badge tone={STATUS_LABELS[status].tone}>
                        {STATUS_LABELS[status].label}
                      </Badge>
                    ) : null}

                    {isBillRecord(record) ? (
                      <Button
                        size="sm"
                        variant={record.paid_at ? "ghost" : "secondary"}
                        onClick={() => void markPaid(record)}
                      >
                        {record.paid_at ? "برگرداندن" : "پرداخت شد"}
                      </Button>
                    ) : null}
                  </div>
                </Card>

                <div className="mt-1 px-1">
                  <FinanceRecordActions record={record} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
