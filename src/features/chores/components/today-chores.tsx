"use client";

import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { TodayChoreItem } from "@/features/chores/today";
import { Badge } from "@/shared/ui/badge";
import { SectionLabel } from "@/shared/ui/section-label";
import { cn } from "@/shared/utils/cn";

type Member = { userId: string; fullName: string };

export function TodayChores({
  items,
  members,
}: {
  items: TodayChoreItem[];
  members: Member[];
}) {
  const router = useRouter();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const nameOf = useMemo(() => {
    const map = new Map(members.map((m) => [m.userId, m.fullName]));
    return (id: string | null) => {
      if (!id) return "—";
      return map.get(id) ?? "کاربر";
    };
  }, [members]);

  const overdue = items.filter((i) => i.overdue);
  const todayOpen = items.filter((i) => !i.overdue && !i.completed);
  const todayDone = items.filter((i) => !i.overdue && i.completed);

  async function complete(item: TodayChoreItem) {
    const key = `${item.choreId}:${item.forDate}`;
    setPendingKey(key);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/chores/${item.choreId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forDate: item.forDate }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "ثبت انجام کار ناموفق بود.");
      }
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "ثبت انجام کار ناموفق بود.",
      );
    } finally {
      setPendingKey(null);
    }
  }

  function Row({ item }: { item: TodayChoreItem }) {
    const key = `${item.choreId}:${item.forDate}`;
    const busy = pendingKey === key;

    return (
      <li className="flex items-start gap-3 px-4 py-3.5">
        <button
          type="button"
          disabled={busy || item.completed}
          onClick={() => void complete(item)}
          aria-label={item.completed ? "انجام شده" : `انجام ${item.title}`}
          className={cn(
            "mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border transition",
            item.completed
              ? "border-olive bg-olive text-cream dark:text-[#221c14]"
              : "border-line-strong bg-paper text-transparent hover:border-olive hover:text-olive/50",
          )}
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin text-olive" />
          ) : (
            <Check className="size-3.5" strokeWidth={2.5} />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p
              className={cn(
                "text-sm font-medium",
                item.completed ? "text-muted line-through" : "text-ink",
              )}
            >
              {item.title}
            </p>
            {item.overdue ? (
              <Badge tone="danger">معوق</Badge>
            ) : item.completed ? (
              <Badge tone="success">انجام شد</Badge>
            ) : null}
          </div>
          {item.description ? (
            <p className="mt-0.5 text-[12px] text-muted">{item.description}</p>
          ) : null}
          <p className="mt-0.5 text-[11px] text-muted">
            تاریخ: {item.forDate} · مسئول: {nameOf(item.assignedTo)}
          </p>
        </div>
      </li>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <SectionLabel className="min-w-0 flex-1">کارهای خانه</SectionLabel>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          {overdue.length > 0 ? (
            <Badge tone="danger">{overdue.length} معوق</Badge>
          ) : null}
          {todayDone.length > 0 ? (
            <Badge tone="success">{todayDone.length} انجام‌شده</Badge>
          ) : null}
        </div>
      </div>

      {errorMessage ? (
        <p className="rounded-field border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger-ink">
          {errorMessage}
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className="rounded-field border border-dashed border-line-strong/70 px-4 py-4 text-center text-[13px] text-muted">
          کار خانه‌ای برای امروز نیست — کارهای تعریف‌شده و معوق‌ها اینجا
          می‌آیند.
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-card border border-line bg-card shadow-paper">
          {[...overdue, ...todayOpen, ...todayDone].map((item) => (
            <Row key={`${item.choreId}:${item.forDate}`} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}
