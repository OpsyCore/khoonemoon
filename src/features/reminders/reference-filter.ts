import type { ReminderInbox, ReminderState } from "./inbox";

/** Today includes both already-due and future reminders on the local calendar day. */
export function filterReminderInbox(
  inbox: ReminderInbox,
  filter: ReminderState | "ALL",
  now: Date,
) {
  if (filter === "ALL") return [...inbox.active, ...inbox.history];
  if (filter === "TODAY")
    return inbox.active.filter((entry) => {
      const date = new Date(entry.effectiveAt);
      return (
        !Number.isNaN(date.getTime()) &&
        date.toDateString() === now.toDateString()
      );
    });
  return [...inbox.active, ...inbox.history].filter(
    (entry) => entry.state === filter,
  );
}
