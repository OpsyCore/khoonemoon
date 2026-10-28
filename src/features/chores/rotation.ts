import type { ChoreRotationMode, ChoreRotationStep } from "@/features/chores/types";

/**
 * Picks who is responsible for a chore right now.
 *
 * The database advances `current_rotation_index` inside `complete_chore()`,
 * this helper mirrors the same rule on the client so the UI can show the
 * current person without an extra round-trip.
 */
export function resolveCurrentAssignee({
  rotationMode,
  currentRotationIndex,
  steps,
}: {
  rotationMode: ChoreRotationMode;
  currentRotationIndex: number;
  steps: ChoreRotationStep[];
}): string | null {
  if (steps.length === 0) return null;

  const sorted = [...steps].sort((a, b) => a.position - b.position);

  if (rotationMode === "FIXED") {
    return sorted[0].assignee_id;
  }

  const safeIndex =
    ((currentRotationIndex % sorted.length) + sorted.length) % sorted.length;

  return sorted.reduce(
    (found, step) => found ?? (step.position === safeIndex ? step.assignee_id : null),
    null as string | null,
  );
}

export type ChoreState = "OVERDUE" | "DUE_TODAY" | "UPCOMING" | "PAUSED" | "UNSCHEDULED";

export function getChoreState({
  nextDueAt,
  isActive,
  now,
}: {
  nextDueAt: string | null;
  isActive: boolean;
  now: Date;
}): ChoreState {
  if (!isActive) return "PAUSED";
  if (!nextDueAt) return "UNSCHEDULED";

  const due = new Date(nextDueAt);

  if (Number.isNaN(due.getTime())) return "UNSCHEDULED";

  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  if (due < startOfToday) return "OVERDUE";
  if (due <= endOfToday) return "DUE_TODAY";
  return "UPCOMING";
}

/**
 * Builds the default weekly due date used when a chore is created without one.
 */
export function defaultNextDueAt(now: Date): string {
  const next = new Date(now);
  next.setDate(next.getDate() + 1);
  next.setHours(9, 0, 0, 0);
  return next.toISOString();
}
