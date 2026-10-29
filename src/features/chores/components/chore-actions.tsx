"use client";

import { Archive, Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  buildChorePatch,
  CHORE_ARCHIVE_HINT,
  CHORE_ARCHIVE_LABEL,
  EDITABLE_FREQUENCIES,
  FREQUENCY_LABELS,
  toChoreForm,
  type ChoreForm,
} from "@/features/chores/corrections";
import type { ChoreRecord } from "@/features/chores/types";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

/** Edit / archive controls for a single chore. */
export function ChoreActions({
  chore,
  memberCount,
  canManage,
}: {
  chore: ChoreRecord;
  memberCount: number;
  canManage: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "edit" | "confirm-archive">("idle");
  const [form, setForm] = useState<ChoreForm>(() => toChoreForm(chore));
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!canManage) return null;

  const close = () => {
    setMode("idle");
    setMessage(null);
  };

  const save = async () => {
    const result = buildChorePatch({ chore, form, memberCount });

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    if (result.unchanged) {
      setMessage("تغییری اعمال نشد.");
      return;
    }

    setIsBusy(true);
    const response = await fetch(`/api/chores/${chore.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result.patch),
    });
    setIsBusy(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      setMessage(payload?.message ?? "اصلاح کار خانه ناموفق بود.");
      return;
    }

    setMode("idle");
    router.refresh();
  };

  const archive = async () => {
    setIsBusy(true);
    const response = await fetch(`/api/chores/${chore.id}`, {
      method: "DELETE",
    });
    setIsBusy(false);

    if (!response.ok) {
      setMessage("بایگانی کار خانه ناموفق بود.");
      return;
    }

    setMode("idle");
    router.refresh();
  };

  return (
    <div className="space-y-2">
      {mode === "idle" ? (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setForm(toChoreForm(chore));
              setMessage(null);
              setMode("edit");
            }}
          >
            <Pencil className="size-3.5" />
            اصلاح
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setMessage(null);
              setMode("confirm-archive");
            }}
          >
            <Archive className="size-3.5" />
            {CHORE_ARCHIVE_LABEL}
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

          <div className="flex flex-wrap gap-2">
            {EDITABLE_FREQUENCIES.map((option) => (
              <Button
                key={option}
                size="sm"
                variant={form.frequency === option ? "secondary" : "ghost"}
                onClick={() =>
                  setForm((current) => ({ ...current, frequency: option }))
                }
              >
                {FREQUENCY_LABELS[option]}
              </Button>
            ))}
          </div>

          {memberCount > 1 ? (
            <Button
              size="sm"
              variant={form.rotationMode === "ROTATING" ? "secondary" : "ghost"}
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  rotationMode:
                    current.rotationMode === "ROTATING" ? "FIXED" : "ROTATING",
                }))
              }
            >
              نوبت‌بندی چرخشی
            </Button>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button size="sm" isLoading={isBusy} onClick={() => void save()}>
              ذخیره
            </Button>
            <Button size="sm" variant="ghost" onClick={close}>
              انصراف
            </Button>
          </div>
        </div>
      ) : null}

      {mode === "confirm-archive" ? (
        <div className="space-y-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-900 dark:bg-rose-950/30">
          <p className="text-sm font-medium text-rose-800 dark:text-rose-200">
            «{chore.title}» {CHORE_ARCHIVE_LABEL} شود؟
          </p>
          <p className="text-xs text-rose-700 dark:text-rose-300">
            {CHORE_ARCHIVE_HINT}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="danger"
              isLoading={isBusy}
              onClick={() => void archive()}
            >
              بله، {CHORE_ARCHIVE_LABEL} کن
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
