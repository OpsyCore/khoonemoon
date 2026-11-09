export type TaskVisibility = "PRIVATE" | "HOUSEHOLD_SHARED";
export type TaskStatus =
  "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED" | "ARCHIVED";
export type TaskPriority = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
export type TaskKind = "GENERAL" | "CLEANING";

export type CleaningZone =
  | "KITCHEN"
  | "BEDROOM"
  | "LIVING_ROOM"
  | "RESTROOM"
  | "BATHROOM"
  | "BALCONY"
  | "STORAGE"
  | "OTHER";

export const CLEANING_ZONE_LABELS: Record<CleaningZone, string> = {
  KITCHEN: "آشپزخانه",
  BEDROOM: "اتاق خواب",
  LIVING_ROOM: "پذیرایی",
  RESTROOM: "سرویس بهداشتی",
  BATHROOM: "حمام",
  BALCONY: "بالکن و حیاط",
  STORAGE: "انباری و ورودی",
  OTHER: "سایر بخش‌ها",
};

export type CleaningChecklistItem = {
  id: string;
  title: string;
  done: boolean;
};

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
  task_kind?: TaskKind;
  cleaning_zone?: CleaningZone | null;
  cleaning_checklist?: CleaningChecklistItem[];
  source_event_id?: string | null;
  source_occurrence_year?: number | null;
  created_at: string;
  updated_at: string;
  task_assignees: { assignee_id: string }[];
  task_recurrences:
    | {
        frequency: TaskRecurrenceFrequency;
        interval_days: number | null;
        weekdays: number[] | null;
        recurrence_timezone?: string | null;
      }[]
    | null;
};

export type TaskMember = {
  user_id: string;
  full_name: string;
};
