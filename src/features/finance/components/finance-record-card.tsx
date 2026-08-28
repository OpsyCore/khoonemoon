"use client";

import { CheckCircle2, Loader2, Pencil, RotateCcw, Trash2 } from "lucide-react";
import type { FinanceMember, FinanceRecord } from "@/features/finance/types";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardDescription, CardTitle } from "@/shared/ui/card";
import { formatJalaliLongDate } from "@/shared/utils/jalali";
import { formatPersianTime } from "@/shared/utils/locale";
import {
  billStatusLabel,
  billStatusOf,
  billStatusTone,
  formatAmount,
  memberDisplayName,
} from "./finance-display";
import { canPayFinanceRecord } from "./finance-payload";

export function FinanceRecordCard({
  record,
  members,
  busy,
  onPay,
  onUnpay,
  onEdit,
  onDelete,
}: {
  record: FinanceRecord;
  members: FinanceMember[];
  busy: boolean;
  onPay: () => void;
  onUnpay: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const status = billStatusOf(record);
  const whenDate =
    record.record_type === "BILL" && record.due_at
      ? new Date(record.due_at)
      : record.occurred_at
        ? new Date(record.occurred_at)
        : null;
  const when = whenDate
    ? `${formatJalaliLongDate(whenDate)} — ${formatPersianTime(whenDate)}`
    : null;

  return (
    <Card className="min-w-0 space-y-3">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1 break-words">
          <CardTitle>{record.title}</CardTitle>
          <CardDescription>
            {formatAmount(record.amount, record.currency)}
            {record.category ? ` · ${record.category}` : ""}
          </CardDescription>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge tone="neutral">
            {record.record_type === "BILL" ? "قبض" : "هزینه"}
          </Badge>
          <Badge tone="neutral">
            {record.visibility === "PRIVATE" ? "خصوصی" : "اشتراکی"}
          </Badge>
          {status ? (
            <Badge tone={billStatusTone(status)}>{billStatusLabel(status)}</Badge>
          ) : null}
        </div>
      </div>

      <p className="break-words text-xs text-zinc-500 dark:text-zinc-400">
        {record.record_type === "BILL" ? `سررسید: ${when ?? "—"}` : `تاریخ: ${when ?? "—"}`}
        {record.paid_by
          ? ` · پرداخت‌کننده: ${memberDisplayName(members, record.paid_by)}`
          : ""}
      </p>

      <div className="flex flex-wrap gap-2">
        {canPayFinanceRecord(record.record_type) ? (
          record.paid_at ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              aria-busy={busy}
              onClick={onUnpay}
            >
              <RotateCcw className="size-4" />
              لغو پرداخت
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={busy}
              aria-busy={busy}
              onClick={onPay}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              پرداخت
            </Button>
          )
        ) : null}
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onEdit}>
          <Pencil className="size-4" />
          ویرایش
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onDelete}>
          <Trash2 className="size-4" />
          حذف
        </Button>
      </div>
    </Card>
  );
}
