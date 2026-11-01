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
/** Lists actual changes, including ordered assignees; the DB transaction still receives the complete validated schedule. */
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
