import { expect, it } from "vitest";
import { buildReminderInbox } from "./inbox";
import { filterReminderInbox } from "./reference-filter";
import type { ReminderRecord } from "./types";

it("filters today across due and later reminders, without mixing history or past days", () => {
  const now = new Date(2026, 2, 15, 12);
  const row = (
    id: string,
    day: number,
    hour: number,
    status: ReminderRecord["status"] = "PENDING",
  ): ReminderRecord => ({
    id,
    user_id: "u",
    household_id: null,
    target_type: "TASK",
    target_id: "t",
    remind_at: new Date(2026, 2, day, hour).toISOString(),
    status,
    snoozed_until: null,
    snooze_count: 0,
    delivered_at: null,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  });
  const inbox = buildReminderInbox({
    reminders: [
      row("past", 14, 10),
      row("due", 15, 10),
      row("later", 15, 18),
      row("future", 16, 10),
      row("sent", 15, 10, "SENT"),
      row("canceled", 15, 10, "CANCELED"),
    ],
    tasks: [],
    events: [],
    now,
  });
  expect(filterReminderInbox(inbox, "TODAY", now).map((r) => r.id)).toEqual([
    "due",
    "later",
  ]);
  expect(filterReminderInbox(inbox, "DUE", now).map((r) => r.id)).toEqual([
    "past",
    "due",
  ]);
  expect(filterReminderInbox(inbox, "DELIVERED", now).map((r) => r.id)).toEqual(
    ["sent"],
  );
  expect(filterReminderInbox(inbox, "ALL", now)).toHaveLength(6);
});
