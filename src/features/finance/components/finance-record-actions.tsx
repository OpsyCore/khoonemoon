"use client";

import { Archive, Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  buildCorrectionPatch,
  describePatch,
  toCorrectionForm,
  DELETE_ACTION_HINT,
  DELETE_ACTION_LABEL,
  type CorrectionForm,
} from "@/features/finance/corrections";
import type { FinancialRecord } from "@/features/finance/types";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

/**
 * Edit / archive controls for a single financial record.
 *
 * Kept apart from the list so the record card stays readable, and because the
 * edit form owns real state (the list is rendered from server data).
 */
export function FinanceRecordActions({ record }: { record: FinancialRecord }) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "edit" | "confirm-delete">("idle");
  const [form, setForm] = useState<CorrectionForm>(() =>
    toCorrectionForm(record),
  );
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const openEdit = () => {
    setForm(toCorrectionForm(record));
    setMessage(null);
    setMode("edit");
  };

  const close = () => {
    setMode("idle");
    setMessage(null);
  };

  const save = async () => {
    const result = buildCorrectionPatch({ record, form });

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    if (result.unchanged) {
      setMessage("تغییری اعمال نشد.");
      return;
    }

    setIsBusy(true);
    const response = await fetch(`/api/finance/${record.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result.patch),
    });
    setIsBusy(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      setMessage(payload?.message ?? "اصلاح رکورد ناموفق بود.");
      return;
    }

    setMode("idle");
    router.refresh();
  };

  const archive = async () => {
    setIsBusy(true);
    const response = await fetch(`/api/finance/${record.id}`, {
      method: "DELETE",
    });
    setIsBusy(false);

    if (!response.ok) {
      setMessage("بایگانی رکورد ناموفق بود.");
      return;
    }

    setMode("idle");
    router.refresh();
  };

  const pendingChanges =
    mode === "edit" ? buildCorrectionPatch({ record, form }) : null;

  return (
    <div className="space-y-2">
      {mode === "idle" ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={openEdit}>
            <Pencil className="size-3.5" />
            اصلاح
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setMessage(null);
              setMode("confirm-delete");
            }}
          >
            <Archive className="size-3.5" />
            {DELETE_ACTION_LABEL}
          </Button>
        </div>
      ) : null}

      {mode === "edit" ? (
        <div className="space-y-2 rounded-2xl border border-zinc-200 p-3 dark:border-zinc-700">
          <Input
            label="عنوان"
            value={form.title}
            onChange={(event) =>
              setForm((current) => ({ ...current, title: event.target.value }))
            }
          />
          <Input
            label="مبلغ"
            inputMode="numeric"
            value={form.amount}
            onChange={(event) =>
              setForm((current) => ({ ...current, amount: event.target.value }))
            }
          />
          <Input
            label="دسته (اختیاری)"
            placeholder="مثلاً: قبض"
            value={form.category}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                category: event.target.value,
              }))
            }
          />
          <Input
            label="سررسید (اختیاری)"
            type="datetime-local"
            value={form.dueAt}
            onChange={(event) =>
              setForm((current) => ({ ...current, dueAt: event.target.value }))
            }
          />

          <p className="text-xs text-muted">
            {pendingChanges?.ok && pendingChanges.unchanged
              ? "چیزی تغییر نکرده است."
              : pendingChanges?.ok
                ? `تغییرها: ${describePatch(pendingChanges.patch).join("، ")}`
                : ""}
          </p>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" isLoading={isBusy} onClick={() => void save()}>
              ذخیره اصلاح
            </Button>
            <Button size="sm" variant="ghost" onClick={close}>
              انصراف
            </Button>
          </div>
        </div>
      ) : null}

      {mode === "confirm-delete" ? (
        <div className="space-y-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-900 dark:bg-rose-950/30">
          <p className="text-sm font-medium text-rose-800 dark:text-rose-200">
            «{record.title}» {DELETE_ACTION_LABEL} شود؟
          </p>
          <p className="text-xs text-rose-700 dark:text-rose-300">
            {DELETE_ACTION_HINT}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="danger"
              isLoading={isBusy}
              onClick={() => void archive()}
            >
              بله، {DELETE_ACTION_LABEL} کن
            </Button>
            <Button size="sm" variant="ghost" onClick={close}>
              <X className="size-3.5" />
              انصراف
            </Button>
          </div>
        </div>
      ) : null}

      {message ? (
        <p className="text-xs text-rose-600 dark:text-rose-400">{message}</p>
      ) : null}
    </div>
  );
}
