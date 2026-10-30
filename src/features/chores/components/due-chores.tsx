import { Home } from "lucide-react";
import {
  getChoreState,
  resolveCurrentAssignee,
} from "@/features/chores/rotation";
import type { ChoreRecord } from "@/features/chores/types";
import type { TaskMember } from "@/features/tasks/types";
import { Badge } from "@/shared/ui/badge";
import { Card, CardTitle } from "@/shared/ui/card";

const STATE_LABELS: Record<
  "OVERDUE" | "DUE_TODAY",
  { label: string; tone: "danger" | "warning" }
> = {
  OVERDUE: { label: "عقب‌افتاده", tone: "danger" },
  DUE_TODAY: { label: "امروز", tone: "warning" },
};

export function DueChores({
  chores,
  members,
}: {
  chores: ChoreRecord[];
  members: TaskMember[];
}) {
  const now = new Date();
  const memberNames = new Map(members.map((m) => [m.user_id, m.full_name]));

  const due = chores
    .map((chore) => ({
      chore,
      state: getChoreState({
        nextDueAt: chore.next_due_at,
        isActive: chore.is_active,
        now,
      }),
    }))
    .filter(
      (item): item is { chore: ChoreRecord; state: "OVERDUE" | "DUE_TODAY" } =>
        item.state === "OVERDUE" || item.state === "DUE_TODAY",
    )
    .slice(0, 4);

  if (due.length === 0) return null;

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <Home className="size-4 text-olive-ink" />
        <CardTitle>کارهای خانه امروز</CardTitle>
      </div>

      <ul className="space-y-2">
        {due.map(({ chore, state }) => {
          const assigneeId = resolveCurrentAssignee({
            rotationMode: chore.rotation_mode,
            currentRotationIndex: chore.current_rotation_index,
            steps: chore.chore_rotation_steps ?? [],
          });

          return (
            <li
              key={chore.id}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="text-ink">
                {chore.title}
                {assigneeId ? (
                  <span className="block text-xs text-muted">
                    نوبت {memberNames.get(assigneeId) ?? "کاربر"}
                  </span>
                ) : null}
              </span>
              <Badge tone={STATE_LABELS[state].tone}>
                {STATE_LABELS[state].label}
              </Badge>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
