export type ReminderTargetType =
  "TASK" | "EVENT" | "CHORE" | "BILL" | "DOCUMENT" | "APPLIANCE" | "MEAL";

export const REMINDER_TARGET_LABELS: Record<ReminderTargetType, string> = {
  TASK: "تسک",
  EVENT: "رویداد",
  CHORE: "کار خانه",
  BILL: "قبض",
  DOCUMENT: "مدرک",
  APPLIANCE: "وسیله",
  MEAL: "برنامه غذایی",
};

export type ReminderStatus = "PENDING" | "SNOOZED" | "SENT" | "CANCELED";

export type ReminderSourceGroup =
  | "BILL"
  | "SUBSCRIPTION"
  | "MEAL"
  | "APPLIANCE"
  | "OCCASION"
  | "EVENT"
  | "CLEANING"
  | "TASK"
  | "CHORE"
  | "DOCUMENT";

export const REMINDER_GROUP_LABELS: Record<ReminderSourceGroup, string> = {
  BILL: "قبض",
  SUBSCRIPTION: "اشتراک و قسط",
  MEAL: "برنامه غذایی",
  APPLIANCE: "وسایل و تعمیرات",
  OCCASION: "مناسبت",
  EVENT: "رویداد",
  CLEANING: "نظافت",
  TASK: "کارها",
  CHORE: "تقسیم وظایف",
  DOCUMENT: "مدارک",
};

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
