import type { TaskRecurrenceFrequency } from "@/features/tasks/types";

export type ChoreRotationMode = "FIXED" | "ROTATING";

export type ChoreRotationStep = {
  id: string;
  chore_id: string;
  position: number;
  assignee_id: string;
};

export type ChoreRecord = {
  id: string;
  household_id: string;
  title: string;
  description: string | null;
  created_by: string;
  rotation_mode: ChoreRotationMode;
  current_rotation_index: number;
  frequency: TaskRecurrenceFrequency;
  interval_days: number | null;
  weekdays: number[] | null;
  next_due_at: string | null;
  is_active: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  chore_rotation_steps: ChoreRotationStep[] | null;
};

export type ChoreCompletion = {
  id: string;
  chore_id: string;
  completed_by: string;
  completed_at: string;
  due_at: string | null;
  note: string | null;
};
