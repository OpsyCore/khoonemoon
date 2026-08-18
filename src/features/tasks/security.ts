import type {
  TaskPriority,
  TaskRecurrence,
  TaskStatus,
  TaskVisibility,
} from "@/features/tasks/types";

export function canAccessTask({
  viewerId,
  viewerHouseholdIds,
  ownerId,
  householdId,
  visibility,
}: {
  viewerId: string;
  viewerHouseholdIds: string[];
  ownerId: string;
  householdId: string | null;
  visibility: TaskVisibility;
}) {
  if (visibility === "PRIVATE") {
    return viewerId === ownerId;
  }

  if (!householdId) return false;
  return viewerHouseholdIds.includes(householdId);
}

export function validateTaskAssignment({
  visibility,
  ownerId,
  assigneeIds,
  householdMemberIds,
}: {
  visibility: TaskVisibility;
  ownerId: string;
  assigneeIds: string[];
  householdMemberIds: string[];
}) {
  if (visibility === "PRIVATE") {
    if (assigneeIds.length === 0) return true;
    return assigneeIds.length === 1 && assigneeIds[0] === ownerId;
  }

  return assigneeIds.every((id) => householdMemberIds.includes(id));
}

export function applyTaskCompletion({
  currentStatus,
  action,
}: {
  currentStatus: TaskStatus;
  action: "complete" | "undo";
}) {
  if (action === "complete") {
    return {
      status: "COMPLETED" as TaskStatus,
      completedAt: new Date().toISOString(),
    };
  }

  if (currentStatus !== "COMPLETED") {
    return {
      status: currentStatus,
      completedAt: null,
    };
  }

  return {
    status: "PENDING" as TaskStatus,
    completedAt: null,
  };
}

export function normalizeTaskPriority(
  value: TaskPriority | undefined,
): TaskPriority {
  return value ?? "NORMAL";
}

export function normalizeRecurrence(
  value: TaskRecurrence | undefined,
): TaskRecurrence {
  return value ?? { frequency: "NONE" };
}
