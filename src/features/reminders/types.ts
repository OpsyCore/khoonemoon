export type ReminderTargetType = "TASK" | "EVENT";
export type ReminderStatus = "PENDING" | "SNOOZED" | "SENT" | "CANCELED";

export type ReminderRecord = {
  id: string;
  target_type: ReminderTargetType;
  target_id: string;
  user_id: string;
  household_id: string | null;
  remind_at: string;
  status: ReminderStatus;
  snoozed_until: string | null;
  snooze_count: number;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ReminderPreferenceRecord = {
  id: string;
  user_id: string;
  in_app_enabled: boolean;
  web_push_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  created_at: string;
  updated_at: string;
};
