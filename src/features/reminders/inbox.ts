import { effectiveReminderAt } from "@/features/reminders/dispatch";
import type { ReminderRecord } from "@/features/reminders/types";

/**
 * Reminder inbox ("صندوق یادآورها").
 *
 * Until now reminders were only visible as the next 72 hours on the dashboard,
 * and only while pending: a reminder that fired, was missed, or was cancelled
 * simply disappeared. This module turns the whole table into an inbox with an
 * explicit state per reminder, so "did anything get lost?" has an answer.
 */

export type ReminderState =
  "DUE" | "TODAY" | "UPCOMING" | "DELIVERED" | "CANCELED";

export type ReminderTarget = {
  id: string;
  title: string;
};

export type InboxEntry = {
  id: string;
  state: ReminderState;
  targetType: ReminderRecord["target_type"];
  /** Title of the task/event, with an honest fallback when it is gone. */
  title: string;
  /** The moment the reminder fires (snooze target when snoozed). */
  effectiveAt: string;
  remindAt: string;
  status: ReminderRecord["status"];
  snoozeCount: number;
  deliveredAt: string | null;
};

export type InboxSection = {
  state: ReminderState;
  entries: InboxEntry[];
};

export type ReminderInbox = {
  /** Actionable reminders (due / today / upcoming), soonest first. */
  active: InboxEntry[];
  /** Delivered + cancelled, newest first. */
  history: InboxEntry[];
  sections: InboxSection[];
  counts: {
    due: number;
    today: number;
    upcoming: number;
    delivered: number;
    canceled: number;
    /** Everything that still needs attention. */
    open: number;
  };
  /** The soonest open reminder, for a "next up" line. */
  nextAt: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const TERMINAL_STATES: ReminderState[] = ["DELIVERED", "CANCELED"];

function startOfDay(date: Date): number {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

/**
 * Classifies one reminder.
 *
 * Delivered/cancelled reminders are history no matter what their timestamp says;
 * a pending reminder in the past is "due" (the dashboard already calls it
 * overdue), one later today is "today", and anything beyond is "upcoming".
 */
export function classifyReminder({
  reminder,
  now,
}: {
  reminder: Pick<ReminderRecord, "status" | "remind_at"> &
    Partial<Pick<ReminderRecord, "snoozed_until" | "delivered_at">>;
  now: Date;
}): ReminderState {
  if (reminder.status === "SENT" || reminder.delivered_at) return "DELIVERED";
  if (reminder.status === "CANCELED") return "CANCELED";

  const at = effectiveReminderAt(reminder as ReminderRecord).getTime();

  // An unparseable timestamp must not crash the inbox; treat it as due so it is
  // visible instead of silently vanishing.
  if (Number.isNaN(at)) return "DUE";

  if (at <= now.getTime()) return "DUE";

  return startOfDay(new Date(at)) === startOfDay(now) ? "TODAY" : "UPCOMING";
}

/**
 * Resolves the task/event a reminder points at.
 * The fallbacks are deliberately explicit: a deleted task should say so rather
 * than showing an empty title the user cannot act on.
 */
export function resolveTargetTitle({
  reminder,
  tasks,
  events,
}: {
  reminder: Pick<ReminderRecord, "target_type" | "target_id">;
  tasks: ReminderTarget[];
  events: ReminderTarget[];
}): string {
  const pool = reminder.target_type === "TASK" ? tasks : events;
  const found = pool.find((item) => item.id === reminder.target_id);

  if (found) return found.title;

  return reminder.target_type === "TASK" ? "تسک حذف‌شده" : "رویداد حذف‌شده";
}

function toEntry({
  reminder,
  tasks,
  events,
  now,
}: {
  reminder: ReminderRecord;
  tasks: ReminderTarget[];
  events: ReminderTarget[];
  now: Date;
}): InboxEntry {
  const effective = effectiveReminderAt(reminder);

  return {
    id: reminder.id,
    state: classifyReminder({ reminder, now }),
    targetType: reminder.target_type,
    title: resolveTargetTitle({ reminder, tasks, events }),
    effectiveAt: Number.isNaN(effective.getTime())
      ? reminder.remind_at
      : effective.toISOString(),
    remindAt: reminder.remind_at,
    status: reminder.status,
    snoozeCount: reminder.snooze_count,
    deliveredAt: reminder.delivered_at,
  };
}

function timeOf(entry: InboxEntry): number {
  const value = new Date(entry.effectiveAt).getTime();
  return Number.isNaN(value) ? 0 : value;
}

export function buildReminderInbox({
  reminders,
  tasks,
  events,
  now,
}: {
  reminders: ReminderRecord[];
  tasks: ReminderTarget[];
  events: ReminderTarget[];
  now: Date;
}): ReminderInbox {
  const entries = reminders.map((reminder) =>
    toEntry({ reminder, tasks, events, now }),
  );

  const isHistory = (entry: InboxEntry) =>
    TERMINAL_STATES.includes(entry.state);

  const active = entries
    .filter((entry) => !isHistory(entry))
    .sort((a, b) => timeOf(a) - timeOf(b));

  const history = entries
    .filter(isHistory)
    .sort((a, b) => timeOf(b) - timeOf(a));

  const countOf = (state: ReminderState) =>
    entries.filter((entry) => entry.state === state).length;

  const sections: InboxSection[] = [
    { state: "DUE" as const, entries: active.filter((e) => e.state === "DUE") },
    {
      state: "TODAY" as const,
      entries: active.filter((e) => e.state === "TODAY"),
    },
    {
      state: "UPCOMING" as const,
      entries: active.filter((e) => e.state === "UPCOMING"),
    },
    {
      state: "DELIVERED" as const,
      entries: history.filter((e) => e.state === "DELIVERED"),
    },
    {
      state: "CANCELED" as const,
      entries: history.filter((e) => e.state === "CANCELED"),
    },
  ].filter((section) => section.entries.length > 0);

  return {
    active,
    history,
    sections,
    counts: {
      due: countOf("DUE"),
      today: countOf("TODAY"),
      upcoming: countOf("UPCOMING"),
      delivered: countOf("DELIVERED"),
      canceled: countOf("CANCELED"),
      open: active.length,
    },
    nextAt: active[0]?.effectiveAt ?? null,
  };
}

/**
 * True when a reminder has been snoozed suspiciously often — a hint that it is
 * being avoided rather than handled.
 */
export function isRepeatedlySnoozed(entry: Pick<InboxEntry, "snoozeCount">) {
  return entry.snoozeCount >= 2;
}

/** Days between two dates, used for the "چند روز مانده" hint. */
export function daysUntil({
  iso,
  now,
}: {
  iso: string;
  now: Date;
}): number | null {
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return null;

  return Math.round((startOfDay(new Date(target)) - startOfDay(now)) / DAY_MS);
}
