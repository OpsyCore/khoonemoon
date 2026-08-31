"use client";

import {
  CheckCircle2,
  Loader2,
  Pencil,
  Receipt,
  RotateCcw,
  Trash2,
  Wallet,
} from "lucide-react";
import type { FinanceMember, FinanceRecord } from "@/features/finance/types";
import { Badge } from "@/shared/ui/badge";
import { Card } from "@/shared/ui/card";
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
  const isBill = record.record_type === "BILL";
  const whenDate =
    isBill && record.due_at
      ? new Date(record.due_at)
      : record.occurred_at
        ? new Date(record.occurred_at)
        : null;
  const when = whenDate
    ? `${formatJalaliLongDate(whenDate)} — ${formatPersianTime(whenDate)}`
    : null;

  return (
    <Card className="min-w-0 space-y-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-field bg-sunken text-ink-soft">
          {isBill ? (
            <Receipt className="size-4" strokeWidth={1.75} />
          ) : (
            <Wallet className="size-4" strokeWidth={1.75} />
          )}
        </span>
        <div className="min-w-0 flex-1 break-words">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-ink">{record.title}</p>
            {status ? (
              <Badge tone={billStatusTone(status)}>
                {billStatusLabel(status)}
              </Badge>
            ) : null}
          </div>
          <p className="mt-0.5 text-[15px] font-semibold text-ink">
            {formatAmount(record.amount, record.currency)}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge tone="neutral">{isBill ? "قبض" : "هزینه"}</Badge>
            <Badge tone="neutral">
              {record.visibility === "PRIVATE" ? "خصوصی" : "اشتراکی"}
            </Badge>
            {record.category ? (
              <span className="text-[11px] text-muted">{record.category}</span>
            ) : null}
          </div>
          <p className="mt-1.5 break-words text-[11px] text-muted">
            {isBill ? `سررسید: ${when ?? "—"}` : `تاریخ: ${when ?? "—"}`}
            {record.paid_by
              ? ` · پرداخت‌کننده: ${memberDisplayName(members, record.paid_by)}`
              : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            disabled={busy}
            onClick={onEdit}
            aria-label="ویرایش"
            className="inline-flex size-8 items-center justify-center rounded-full text-muted transition hover:bg-sunken hover:text-ink"
          >
            <Pencil className="size-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onDelete}
            aria-label="حذف"
            className="inline-flex size-8 items-center justify-center rounded-full text-muted transition hover:bg-danger-soft hover:text-danger-ink"
          >
            <Trash2 className="size-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {canPayFinanceRecord(record.record_type) ? (
        <div className="pr-12">
          {record.paid_at ? (
            <button
              type="button"
              disabled={busy}
              aria-busy={busy}
              onClick={onUnpay}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line-strong bg-paper px-3.5 text-[12px] font-medium text-ink-soft transition hover:bg-sunken disabled:opacity-60"
            >
              <RotateCcw className="size-3.5" strokeWidth={1.75} />
              لغو پرداخت
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              aria-busy={busy}
              onClick={onPay}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-olive px-3.5 text-[12px] font-medium text-cream transition hover:bg-olive-deep disabled:opacity-60 dark:text-[#221c14]"
            >
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="size-3.5" strokeWidth={2} />
              )}
              پرداخت
            </button>
          )}
        </div>
      ) : null}
    </Card>
  );
}
