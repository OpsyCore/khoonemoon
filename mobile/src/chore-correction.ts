import { createChoreSchema } from "@/features/chores/schemas";
import type { ChoreRecord } from "@/features/chores/types";

type Input = {
  title: string;
  description: string;
  nextDueAt: string | null;
  rotationMode: ChoreRecord["rotation_mode"];
  assigneeIds: string[];
  frequency: ChoreRecord["frequency"];
  intervalDays: number | null;
  weekdays: number[] | null;
};
const comparable = (value: string | null) =>
  value?.endsWith("+00:00") ? value.slice(0, -6) + "Z" : value;
/** Lists actual changes, including ordered assignees. */
export function choreChanges(original: ChoreRecord, input: Input): string[] {
  const value = createChoreSchema.parse(input);
  const changes: string[] = [];
  if (value.title !== original.title) changes.push("عنوان");
  if ((value.description || null) !== original.description)
    changes.push("توضیحات");
  if (comparable(value.nextDueAt ?? null) !== comparable(original.next_due_at))
    changes.push("سررسید");
  if (value.rotationMode !== original.rotation_mode) changes.push("نوع نوبت");
  const previous = [...(original.chore_rotation_steps ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((step) => step.assignee_id);
  if (JSON.stringify(value.assigneeIds) !== JSON.stringify(previous))
    changes.push("ترتیب اعضا");
  if (
    value.frequency !== original.frequency ||
    (value.intervalDays ?? null) !== original.interval_days ||
    JSON.stringify(value.weekdays ?? null) !== JSON.stringify(original.weekdays)
  )
    changes.push("تکرار");
  return changes;
}

/** Validate the full form but send only fields that differ from the snapshot. */
export function chorePatch(
  original: ChoreRecord,
  input: Input,
  recurrenceTimezone: string,
) {
  const value = createChoreSchema.parse(input);
  const patch: Record<string, unknown> = {};
  if (value.title !== original.title) patch.title = value.title;
  if ((value.description || null) !== original.description)
    patch.description = value.description || null;
  if (
    comparable(value.nextDueAt ?? null) !== comparable(original.next_due_at)
  ) {
    patch.nextDueAt = value.nextDueAt ?? null;
    patch.recurrenceTimezone = recurrenceTimezone;
  }
  if (value.rotationMode !== original.rotation_mode)
    patch.rotationMode = value.rotationMode;
  const previous = [...(original.chore_rotation_steps ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((step) => step.assignee_id);
  if (JSON.stringify(value.assigneeIds) !== JSON.stringify(previous))
    patch.assigneeIds = value.assigneeIds;
  if (value.frequency !== original.frequency) patch.frequency = value.frequency;
  if ((value.intervalDays ?? null) !== original.interval_days)
    patch.intervalDays = value.intervalDays ?? null;
  if (
    JSON.stringify(value.weekdays ?? null) !== JSON.stringify(original.weekdays)
  )
    patch.weekdays = value.weekdays ?? null;
  return patch;
}
