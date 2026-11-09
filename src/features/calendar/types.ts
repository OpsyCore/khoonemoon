export type EventVisibility = "PRIVATE" | "HOUSEHOLD_SHARED";
export type OccasionType = "BIRTHDAY" | "ANNIVERSARY" | "PERSONAL";
export { OCCASION_LABELS } from "./occasions";

export type EventRecord = {
  id: string;
  title: string;
  description: string | null;
  creator_id: string;
  owner_id: string;
  household_id: string | null;
  visibility: EventVisibility;
  start_at: string;
  end_at: string;
  all_day: boolean;
  location: string | null;
  occasion_type?: OccasionType | null;
  recurrence_calendar?: "JALALI_YEARLY" | null;
  jalali_month?: number | null;
  jalali_day?: number | null;
  gift_idea?: string | null;
  occasion_plan?: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectedEventRecord = EventRecord & {
  occurrenceYear?: number;
  yearsElapsed?: number;
  leapAdjusted?: boolean;
};

export type CalendarView = "month" | "week" | "agenda";
