import type {
  CreateChoreInput,
  UpdateChoreInput,
} from "@/features/chores/schemas";
import {
  getChoreOccurrenceDates,
  getChoreOccurrenceIndex,
  getRotationAssignee,
} from "@/features/chores/recurrence";
import type {
  ChoreRecurrence,
  ChoreRotationMember,
} from "@/features/chores/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getCurrentChoreMembership(userId: string) {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", userId)
    .is("left_at", null)
    .maybeSingle();

  if (error) {
    throw new Error("FAILED_TO_LOAD_MEMBERSHIP");
  }

  return data;
}

export async function getChoreHouseholdMemberIds(householdId: string) {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("household_members")
    .select("user_id")
    .eq("household_id", householdId)
    .is("left_at", null);

  if (error) {
    throw new Error("FAILED_TO_LOAD_HOUSEHOLD_MEMBERS");
  }

  return (data ?? []).map((item) => item.user_id);
}

export async function validateCreateChoreForUser({
  userId,
  input,
}: {
  userId: string;
  input: CreateChoreInput;
}) {
  const membership = await getCurrentChoreMembership(userId);

  if (!membership?.household_id) {
    throw new Error("NO_HOUSEHOLD_FOR_CHORE");
  }

  const memberIds = await getChoreHouseholdMemberIds(membership.household_id);

  if (input.defaultAssigneeId && !memberIds.includes(input.defaultAssigneeId)) {
    throw new Error("INVALID_DEFAULT_ASSIGNEE");
  }

  if (
    input.rotationUserIds.some(
      (rotationUserId) => !memberIds.includes(rotationUserId),
    )
  ) {
    throw new Error("INVALID_ROTATION_MEMBER");
  }

  return {
    householdId: membership.household_id,
    memberIds,
  };
}

export async function validateUpdateChoreForUser({
  userId,
  householdId,
  input,
}: {
  userId: string;
  householdId: string;
  input: UpdateChoreInput;
}) {
  const membership = await getCurrentChoreMembership(userId);

  if (!membership?.household_id || membership.household_id !== householdId) {
    throw new Error("CHORE_ACCESS_DENIED");
  }

  const memberIds = await getChoreHouseholdMemberIds(householdId);

  if (input.defaultAssigneeId && !memberIds.includes(input.defaultAssigneeId)) {
    throw new Error("INVALID_DEFAULT_ASSIGNEE");
  }

  if (
    input.rotationUserIds &&
    input.rotationUserIds.some(
      (rotationUserId) => !memberIds.includes(rotationUserId),
    )
  ) {
    throw new Error("INVALID_ROTATION_MEMBER");
  }

  return {
    householdId,
    memberIds,
  };
}

export function choreRecurrenceToRow(recurrence: ChoreRecurrence) {
  return {
    frequency: recurrence.frequency,
    interval_days: recurrence.intervalDays ?? null,
    weekdays: recurrence.weekdays ?? null,
  };
}

export function rotationToRows({
  choreId,
  userIds,
}: {
  choreId: string;
  userIds: string[];
}) {
  return userIds.map((userId, position) => ({
    chore_id: choreId,
    user_id: userId,
    position,
  }));
}

export function resolveChoreAssignment({
  startDate,
  forDate,
  recurrence,
  rotation,
  defaultAssigneeId,
}: {
  startDate: string;
  forDate: string;
  recurrence: ChoreRecurrence;
  rotation: ChoreRotationMember[];
  defaultAssigneeId: string | null;
}) {
  const occurrenceIndex = getChoreOccurrenceIndex({
    startDate,
    occurrenceDate: forDate,
    recurrence,
  });

  if (occurrenceIndex === null) {
    throw new Error("NOT_A_CHORE_OCCURRENCE");
  }

  return {
    occurrenceIndex,
    assignedTo: getRotationAssignee({
      rotation,
      occurrenceIndex,
      defaultAssigneeId,
    }),
  };
}

export function getChoreOccurrencesInRange({
  choreId,
  startDate,
  fromDate,
  toDate,
  recurrence,
  rotation,
  defaultAssigneeId,
  completedDates,
}: {
  choreId: string;
  startDate: string;
  fromDate: string;
  toDate: string;
  recurrence: ChoreRecurrence;
  rotation: ChoreRotationMember[];
  defaultAssigneeId: string | null;
  completedDates: Set<string>;
}) {
  const dates = getChoreOccurrenceDates({
    startDate,
    fromDate,
    toDate,
    recurrence,
  });

  return dates.map((forDate) => {
    const assignment = resolveChoreAssignment({
      startDate,
      forDate,
      recurrence,
      rotation,
      defaultAssigneeId,
    });

    return {
      choreId,
      forDate,
      occurrenceIndex: assignment.occurrenceIndex,
      assignedTo: assignment.assignedTo,
      completed: completedDates.has(forDate),
    };
  });
}
