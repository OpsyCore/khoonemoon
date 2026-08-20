"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { TodayChoreItem } from "@/features/chores/today";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardDescription, CardTitle } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";

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
      <li>
        <Card className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>{item.title}</CardTitle>
              {item.description ? (
                <CardDescription>{item.description}</CardDescription>
              ) : null}
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                تاریخ: {item.forDate} · مسئول: {nameOf(item.assignedTo)}
              </p>
            </div>
            {item.overdue ? (
              <Badge tone="danger">معوق</Badge>
            ) : item.completed ? (
              <Badge tone="success">انجام شد</Badge>
            ) : (
              <Badge tone="info">امروز</Badge>
            )}
          </div>

          {!item.completed ? (
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void complete(item)}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              انجام شد
            </Button>
          ) : null}
        </Card>
      </li>
    );
  }

  if (items.length === 0) {
    return (
      <section className="space-y-3">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          کارهای خانه
        </h3>
        <EmptyState
          title="کار خانه‌ای برای امروز نیست"
          description="اگر کاری تعریف کرده باشید، occurrence امروز و معوق‌ها اینجا می‌آید."
        />
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          کارهای خانه
        </h3>
        <div className="flex flex-wrap gap-2 text-xs">
          {overdue.length > 0 ? (
            <Badge tone="danger">{overdue.length} معوق</Badge>
          ) : null}
          <Badge tone="info">{todayOpen.length} امروز</Badge>
          {todayDone.length > 0 ? (
            <Badge tone="success">{todayDone.length} انجام‌شده</Badge>
          ) : null}
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
              <Row key={`${item.choreId}:${item.forDate}`} item={item} />
            ))}
          </ul>
        </div>
      ) : null}

      {todayOpen.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-sky-700 dark:text-sky-300">
            امروز
          </p>
          <ul className="space-y-2">
            {todayOpen.map((item) => (
              <Row key={`${item.choreId}:${item.forDate}`} item={item} />
            ))}
          </ul>
        </div>
      ) : null}

      {todayDone.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
            انجام‌شده امروز
          </p>
          <ul className="space-y-2">
            {todayDone.map((item) => (
              <Row key={`${item.choreId}:${item.forDate}`} item={item} />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
