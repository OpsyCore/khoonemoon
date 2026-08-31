"use client";

import { useState } from "react";
import { BellPlus } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

type ReminderComposerProps = {
  targetType: "TASK" | "EVENT";
  targetId: string;
  baseDateTime: string;
  householdId: string | null;
  onCreated?: () => void;
};

export function ReminderComposer({
  targetType,
  targetId,
  baseDateTime,
  householdId,
  onCreated,
}: ReminderComposerProps) {
  const [open, setOpen] = useState(false);
  const [offsets, setOffsets] = useState("1440,60,10");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const submit = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    const parsedOffsets = offsets
      .split(",")
      .map((item) => Number(item.trim()))
      .filter((value) => Number.isFinite(value) && value >= 0)
      .slice(0, 10)
      .map((minutesBefore) => ({ minutesBefore }));

    if (!parsedOffsets.length) {
      setError("حداقل یک offset معتبر وارد کنید.");
      setLoading(false);
      return;
    }

    const response = await fetch("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetType,
        targetId,
        baseDateTime,
        offsets: parsedOffsets,
        householdId,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      message?: string;
    };

    if (!response.ok) {
      setError(payload.message ?? "ثبت یادآور ناموفق بود.");
      setLoading(false);
      return;
    }

    setSuccess("یادآورها ثبت شدند.");
    setLoading(false);
    onCreated?.();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-7 items-center gap-1.5 rounded-full border border-line-strong bg-paper px-3 text-[11px] font-medium text-ink-soft transition hover:bg-sunken"
      >
        <BellPlus className="size-3.5" strokeWidth={1.75} />
        یادآور
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-field border border-olive/40 bg-olive-soft/40 p-3.5">
      <Input
        label="Offset دقیقه‌ای (مثال: 1440,60,10)"
        value={offsets}
        onChange={(event) => setOffsets(event.target.value)}
        hint="به معنای: ۱ روز، ۱ ساعت و ۱۰ دقیقه قبل"
      />

      {error ? <p className="text-xs text-danger-ink">{error}</p> : null}
      {success ? <p className="text-xs text-olive-ink">{success}</p> : null}

      <div className="flex gap-2">
        <Button size="sm" onClick={submit} isLoading={loading}>
          ذخیره یادآور
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          بستن
        </Button>
      </div>
    </div>
  );
}
