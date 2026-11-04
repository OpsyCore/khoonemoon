import { History } from "lucide-react";
import {
  groupChoreHistoryByDay,
  summarizeChoreHistory,
} from "@/features/chores/history";
import type { ChoreCompletion, ChoreRecord } from "@/features/chores/types";
import type { TaskMember } from "@/features/tasks/types";
import { Badge } from "@/shared/ui/badge";
import { Card, CardDescription, CardTitle } from "@/shared/ui/card";
import { formatPersianTime, toPersianNumber } from "@/shared/utils/locale";

/**
 * "تاریخچه کارهای خانه" — who did what, and whether the workload is balanced.
 * Rendering-only: the grouping and counting live in `history.ts`.
 */
export function ChoreHistory({
  completions,
  chores,
  members,
}: {
  completions: ChoreCompletion[];
  chores: ChoreRecord[];
  members: TaskMember[];
}) {
  const summary = summarizeChoreHistory({
    completions,
    chores: chores.map((chore) => ({ id: chore.id, title: chore.title })),
    members,
    now: new Date(),
    windowDays: 30,
  });

  if (summary.total === 0) {
    return (
      <Card className="space-y-2">
        <div className="flex items-center gap-2">
          <History className="size-4 text-zinc-500" />
          <CardTitle>تاریخچه کارهای خانه</CardTitle>
        </div>
        <p className="text-sm text-ink-soft">
          هنوز کاری در ۳۰ روز گذشته انجام نشده است. با زدن «انجام شد» روی هر
          کار، اینجا ثبت می‌شود که چه کسی و چه زمانی انجامش داده.
        </p>
      </Card>
    );
  }

  const groups = groupChoreHistoryByDay(summary.entries);

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <History className="size-4 text-zinc-500" />
          <CardTitle>تاریخچه کارهای خانه</CardTitle>
        </div>
        <Badge tone="neutral">
          {toPersianNumber(summary.total)} مورد در ۳۰ روز
        </Badge>
      </div>

      <CardDescription>
        سهم هر نفر در ۳۰ روز گذشته؛ اگر کسی جلوتر است، نوبت‌ها را جابه‌جا کنید.
      </CardDescription>

      <ul className="space-y-1.5">
        {summary.shares.map((share) => {
          const width =
            summary.busiestCount > 0
              ? Math.round((share.count / summary.busiestCount) * 100)
              : 0;

          return (
            <li key={share.memberId} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="truncate">{share.memberName}</span>
                <span className="tabular-nums text-ink-soft">
                  {toPersianNumber(share.count)} مورد
                </span>
              </div>
              <div
                role="presentation"
                className="h-1.5 w-full overflow-hidden rounded-full bg-sunken"
              >
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${width}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="space-y-3 border-t border-line pt-3">
        {groups.map((group) => (
          <div key={group.key} className="space-y-1.5">
            <p className="text-xs font-medium text-muted">{group.label}</p>
            <ul className="space-y-1">
              {group.entries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-2 rounded-xl bg-sunken px-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{entry.memberName}</span>
                    <span className="text-muted">
                      {" · "}
                      {entry.choreTitle}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-xs text-muted">
                    {formatPersianTime(entry.completedAt)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}
