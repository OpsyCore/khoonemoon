import type { ChoreRecord, ChoreCompletion } from "./types";
import { resolveCurrentAssignee, getChoreState } from "./rotation";
export type NamedMember = { id: string; full_name: string | null };
export type HistoryRow = ChoreCompletion & {
  chores: { id: string; title: string };
};
export function weekStart(now: Date) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 1) % 7));
  return start;
}
export function choreDashboardModel(
  chores: ChoreRecord[],
  history: HistoryRow[],
  members: NamedMember[],
  now: Date,
) {
  const names = new Map(members.map((m) => [m.id, m.full_name || "کاربر"]));
  const active = chores.filter((c) => c.is_active && !c.archived_at);
  const today = active.filter(
    (c) =>
      getChoreState({ nextDueAt: c.next_due_at, isActive: true, now }) ===
      "DUE_TODAY",
  );
  const due = active.filter((c) =>
    ["OVERDUE", "DUE_TODAY"].includes(
      getChoreState({ nextDueAt: c.next_due_at, isActive: true, now }),
    ),
  );
  const upcoming = active.filter(
    (c) =>
      !["OVERDUE", "DUE_TODAY"].includes(
        getChoreState({ nextDueAt: c.next_due_at, isActive: true, now }),
      ),
  );
  const assigned = [
    ...new Set(
      today
        .map((c) =>
          resolveCurrentAssignee({
            rotationMode: c.rotation_mode,
            currentRotationIndex: c.current_rotation_index,
            steps: c.chore_rotation_steps ?? [],
          }),
        )
        .filter((x): x is string => !!x),
    ),
  ];
  const start = weekStart(now).getTime(),
    end = now.getTime();
  const week = history.filter((row) => {
    const t = Date.parse(row.completed_at);
    return Number.isFinite(t) && t >= start && t <= end;
  });
  const counts = new Map(members.map((m) => [m.id, 0]));
  for (const row of week)
    counts.set(row.completed_by, (counts.get(row.completed_by) ?? 0) + 1);
  const shares = [...counts].map(([id, count]) => ({
    id,
    name: names.get(id) ?? "عضو سابق خانه",
    count,
    percent: week.length ? Math.round((count * 100) / week.length) : 0,
  }));
  return {
    active,
    today,
    due,
    upcoming,
    assignedNames: assigned.map((id) => names.get(id) ?? "عضو سابق خانه"),
    shares,
    total: week.length,
    names,
  };
}
export function dueLabel(value: string | null, now: Date) {
  if (!value) return "بدون زمان";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "زمان نامشخص";
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const tomorrow = new Date(start);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const after = new Date(tomorrow);
  after.setDate(after.getDate() + 1);
  if (date < start) return "عقب‌افتاده";
  if (date < tomorrow) return "امروز";
  if (date < after) return "فردا";
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    day: "numeric",
    month: "long",
  }).format(date);
}
export function frequencyLabel(chore: ChoreRecord) {
  switch (chore.frequency) {
    case "DAILY":
      return "روزانه";
    case "WEEKLY":
      return chore.weekdays?.length
        ? `${chore.weekdays.length.toLocaleString("fa-IR")} روز در هفته`
        : "هفتگی";
    case "MONTHLY":
      return "ماهانه";
    case "YEARLY":
      return "سالانه";
    case "INTERVAL_DAYS":
      return `هر ${(chore.interval_days ?? 0).toLocaleString("fa-IR")} روز`;
    default:
      return "بدون تکرار";
  }
}
