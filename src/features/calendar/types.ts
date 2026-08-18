export type EventVisibility = "PRIVATE" | "HOUSEHOLD_SHARED";

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
  created_at: string;
  updated_at: string;
};

export type CalendarView = "month" | "week" | "agenda";
