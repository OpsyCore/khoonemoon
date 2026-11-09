import type { ReminderHorizon, ReminderInbox, ReminderState } from "./inbox";
import type { ReminderSourceGroup } from "./types";

export type ReminderHubFilter =
  ReminderState | "TOMORROW" | "NEXT_7_DAYS" | "ALL";

/** Today includes both already-due and future reminders on the local calendar day. */
export function filterReminderInbox(
  inbox: ReminderInbox,
  filter: ReminderHubFilter,
  now: Date,
  groupFilter: ReminderSourceGroup | "ALL" = "ALL",
) {
  let base;
  if (filter === "ALL") base = [...inbox.active, ...inbox.history];
  else if (filter === "TODAY")
    base = inbox.active.filter((entry) => {
      const date = new Date(entry.effectiveAt);
      return (
        !Number.isNaN(date.getTime()) &&
        date.toDateString() === now.toDateString()
      );
    });
  else if (filter === "TOMORROW" || filter === "NEXT_7_DAYS")
    base = inbox.active.filter(
      (entry) => entry.horizon === (filter as ReminderHorizon),
    );
  else
    base = [...inbox.active, ...inbox.history].filter(
      (entry) => entry.state === filter,
    );

  return groupFilter === "ALL"
    ? base
    : base.filter((entry) => entry.sourceGroup === groupFilter);
}
