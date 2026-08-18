import { getNextOccurrence } from "@/features/tasks/recurrence";
import type { CreateTaskInput } from "@/features/tasks/schemas";
import {
  normalizeRecurrence,
  validateTaskAssignment,
} from "@/features/tasks/security";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getCurrentMembership(userId: string) {
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

export async function getHouseholdMemberIds(householdId: string | null) {
  if (!householdId) return [];

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

export async function validateTaskInputForUser({
  userId,
  input,
}: {
  userId: string;
  input: CreateTaskInput;
}) {
  const membership = await getCurrentMembership(userId);

  if (input.visibility === "HOUSEHOLD_SHARED") {
    if (!membership?.household_id) {
      throw new Error("NO_HOUSEHOLD_FOR_SHARED_TASK");
    }

    const memberIds = await getHouseholdMemberIds(membership.household_id);

    if (
      !validateTaskAssignment({
        visibility: input.visibility,
        ownerId: userId,
        assigneeIds: input.assigneeIds,
        householdMemberIds: memberIds,
      })
    ) {
      throw new Error("INVALID_TASK_ASSIGNMENT");
    }

    return {
      householdId: membership.household_id,
      memberIds,
      recurrence: normalizeRecurrence(input.recurrence),
    };
  }

  if (
    !validateTaskAssignment({
      visibility: input.visibility,
      ownerId: userId,
      assigneeIds: input.assigneeIds,
      householdMemberIds: [userId],
    })
  ) {
    throw new Error("INVALID_TASK_ASSIGNMENT");
  }

  return {
    householdId: null,
    memberIds: [userId],
    recurrence: normalizeRecurrence(input.recurrence),
  };
}

export function recurrenceToRow({
  dueAt,
  recurrence,
}: {
  dueAt: string | null | undefined;
  recurrence: CreateTaskInput["recurrence"];
}) {
  const normalized = normalizeRecurrence(recurrence);

  if (normalized.frequency === "NONE") {
    return null;
  }

  const sourceDate = dueAt ? new Date(dueAt) : new Date();
  const nextOccurrence = getNextOccurrence({
    from: sourceDate,
    recurrence: normalized,
  });

  return {
    frequency: normalized.frequency,
    interval_days: normalized.intervalDays ?? null,
    weekdays: normalized.weekdays ?? null,
    next_occurrence_at: nextOccurrence?.toISOString() ?? null,
  };
}
