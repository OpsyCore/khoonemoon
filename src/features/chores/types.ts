export const CHORE_FREQUENCIES = [
  "NONE",
  "DAILY",
  "INTERVAL_DAYS",
  "WEEKLY",
  "MONTHLY",
  "YEARLY",
] as const;

export type ChoreFrequency = (typeof CHORE_FREQUENCIES)[number];

export type ChoreRecurrence = {
  frequency: ChoreFrequency;
  intervalDays?: number | null;
  weekdays?: number[] | null;
};

export type ChoreRotationMember = {
  userId: string;
  position: number;
};

export type Chore = {
  id: string;
  householdId: string;
  createdBy: string;
  defaultAssigneeId: string | null;
  title: string;
  description: string | null;
  isActive: boolean;
  startDate: string;
  recurrence: ChoreRecurrence | null;
  rotation: ChoreRotationMember[];
};

export type ChoreCompletion = {
  id: string;
  choreId: string;
  forDate: string;
  assignedTo: string | null;
  completedBy: string;
  completedAt: string;
};

export type ChoreOccurrence = {
  choreId: string;
  forDate: string;
  occurrenceIndex: number;
  assignedTo: string | null;
  completed: boolean;
};
