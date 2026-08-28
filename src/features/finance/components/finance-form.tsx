"use client";

import { Loader2 } from "lucide-react";
import type {
  FinanceRecordType,
  FinanceVisibility,
} from "@/features/finance/types";
import { Button } from "@/shared/ui/button";
import { Card, CardDescription, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";

export type FinanceFormState = {
  recordType: FinanceRecordType;
  title: string;
  amount: string;
  currency: string;
  visibility: FinanceVisibility;
  dueAt: string;
  occurredAt: string;
  category: string;
  note: string;
};

export function FinanceForm({
  state,
  setState,
  canShare,
  isEditing,
  busy,
  onSubmit,
  onCancel,
}: {
  state: FinanceFormState;
  setState: (patch: Partial<FinanceFormState>) => void;
  canShare: boolean;
  isEditing: boolean;
  busy: boolean;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
}) {
  return (
    <Card id="quick-add-finance" className="min-w-0 space-y-4">
      <div className="space-y-1">
        <CardTitle>{isEditing ? "ویرایش مورد مالی" : "مورد مالی جدید"}</CardTitle>
        <CardDescription>
          {isEditing
            ? "نوع و حریم خصوصی پس از ثبت قابل تغییر نیست."
            : canShare
              ? "قبض یا هزینه را خصوصی یا اشتراکی ثبت کنید."
              : "بدون عضویت در خانه فقط مورد خصوصی ثبت می‌شود."}
        </CardDescription>
      </div>

      <form className="space-y-3" onSubmit={onSubmit}>
        {!isEditing ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-100">
                نوع
              </span>
              <select
                className="h-11 w-full rounded-2xl border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                value={state.recordType}
                onChange={(event) =>
                  setState({ recordType: event.target.value as FinanceRecordType })
                }
              >
                <option value="EXPENSE">هزینه</option>
                <option value="BILL">قبض</option>
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-100">
                حریم خصوصی
              </span>
              <select
                className="h-11 w-full rounded-2xl border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                value={canShare ? state.visibility : "PRIVATE"}
                disabled={!canShare}
                onChange={(event) =>
                  setState({
                    visibility: event.target.value as FinanceVisibility,
                  })
                }
              >
                <option value="PRIVATE">خصوصی</option>
                <option value="HOUSEHOLD_SHARED" disabled={!canShare}>
                  اشتراکی خانه
                </option>
              </select>
            </label>
          </div>
        ) : null}

        <Input
          label="عنوان"
          value={state.title}
          onChange={(event) => setState({ title: event.target.value })}
          placeholder={state.recordType === "BILL" ? "مثلاً قبض برق" : "مثلاً نان"}
          maxLength={180}
        />

        <div className="grid grid-cols-2 gap-2">
          <Input
            label="مبلغ"
            type="number"
            min="0.01"
            step="any"
            value={state.amount}
            onChange={(event) => setState({ amount: event.target.value })}
          />
          <Input
            label="واحد"
            value={state.currency}
            onChange={(event) => setState({ currency: event.target.value })}
            maxLength={8}
          />
        </div>

        {state.recordType === "BILL" ? (
          <Input
            label="سررسید"
            type="datetime-local"
            value={state.dueAt}
            onChange={(event) => setState({ dueAt: event.target.value })}
          />
        ) : (
          <Input
            label="تاریخ وقوع"
            type="datetime-local"
            value={state.occurredAt}
            onChange={(event) => setState({ occurredAt: event.target.value })}
          />
        )}

        <Input
          label="دسته‌بندی (اختیاری)"
          value={state.category}
          onChange={(event) => setState({ category: event.target.value })}
          maxLength={80}
        />
        <Input
          label="یادداشت (اختیاری)"
          value={state.note}
          onChange={(event) => setState({ note: event.target.value })}
          maxLength={1000}
        />

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="submit"
            disabled={busy}
            aria-busy={busy}
            className="w-full sm:flex-1"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {isEditing ? "ذخیره تغییرات" : "ثبت"}
          </Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
            انصراف
          </Button>
        </div>
      </form>
    </Card>
  );
}
