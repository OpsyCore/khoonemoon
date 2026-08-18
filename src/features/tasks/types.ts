export type TaskVisibility = "PRIVATE" | "HOUSEHOLD_SHARED";
export type TaskStatus =
  "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED" | "ARCHIVED";
export type TaskPriority = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";

export type TaskRecurrenceFrequency =
  "NONE" | "DAILY" | "INTERVAL_DAYS" | "WEEKLY" | "MONTHLY" | "YEARLY";

export type TaskRecurrence = {
  frequency: TaskRecurrenceFrequency;
  intervalDays?: number | null;
  weekdays?: number[] | null;
};

export type TaskRecord = {
  id: string;
  title: string;
  description: string | null;
  creator_id: string;
  owner_id: string;
  household_id: string | null;
  visibility: TaskVisibility;
  status: TaskStatus;
  priority: TaskPriority;
  due_at: string | null;
  completed_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  task_assignees: { assignee_id: string }[];
  task_recurrences:
    | {
        frequency: TaskRecurrenceFrequency;
        interval_days: number | null;
        weekdays: number[] | null;
      }[]
    | null;
};

export type TaskMember = {
  user_id: string;
  full_name: string;
};
