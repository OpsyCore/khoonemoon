export type TodayTask = {
  id: string;
  title: string;
  due_at: string | null;
  status: string;
};
export type TodayEvent = { id: string; title: string; start_at: string };
export type TodayChore = {
  id: string;
  title: string;
  next_due_at: string | null;
  is_active: boolean;
};
export type TodayBill = {
  id: string;
  title: string;
  due_at: string | null;
  paid_at: string | null;
  record_type: string;
};
export type TodayReminder = {
  id: string;
  remind_at: string;
  status: string;
  snoozed_until: string | null;
  delivered_at: string | null;
};
export function deriveToday(input: {
  tasks: TodayTask[];
  events: TodayEvent[];
  chores: TodayChore[];
  bills: TodayBill[];
  reminders: TodayReminder[];
  now: Date;
}) {
  const start = new Date(input.now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const date = (v: string | null) => (v ? new Date(v).getTime() : NaN);
  const today = (v: string | null) =>
    date(v) >= start.getTime() && date(v) < end.getTime();
  const overdue = (v: string | null) => date(v) < start.getTime();
  const pending = (s: string) =>
    s !== "COMPLETED" && s !== "ARCHIVED" && s !== "CANCELED";
  const bills = new Set(["BILL", "SUBSCRIPTION", "INSTALLMENT"]);
  return {
    tasks: input.tasks.filter(
      (t) => pending(t.status) && (today(t.due_at) || overdue(t.due_at)),
    ),
    events: input.events.filter((e) => today(e.start_at)),
    chores: input.chores.filter(
      (c) => c.is_active && (today(c.next_due_at) || overdue(c.next_due_at)),
    ),
    bills: input.bills.filter(
      (b) =>
        bills.has(b.record_type) &&
        !b.paid_at &&
        (today(b.due_at) || overdue(b.due_at)),
    ),
    reminders: input.reminders.filter(
      (r) =>
        (r.status === "PENDING" || r.status === "SNOOZED") &&
        !r.delivered_at &&
        date(
          r.status === "SNOOZED" && r.snoozed_until
            ? r.snoozed_until
            : r.remind_at,
        ) < end.getTime(),
    ),
  };
}
