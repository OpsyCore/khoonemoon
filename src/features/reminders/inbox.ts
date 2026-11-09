import { effectiveReminderAt } from "@/features/reminders/dispatch";
import type {
  ReminderRecord,
  ReminderSourceGroup,
} from "@/features/reminders/types";

export type ReminderState =
  "DUE" | "TODAY" | "UPCOMING" | "DELIVERED" | "CANCELED";

export type ReminderHorizon =
  | "DUE"
  | "TODAY"
  | "TOMORROW"
  | "NEXT_7_DAYS"
  | "LATER"
  | "DELIVERED"
  | "CANCELED";

export type ReminderTarget = {
  id: string;
  title: string;
  group?: ReminderSourceGroup;
  assigneeLabel?: string | null;
  recurrenceLabel?: string | null;
};

export type InboxEntry = {
  id: string;
  targetId: string;
  state: ReminderState;
  horizon: ReminderHorizon;
  targetType: ReminderRecord["target_type"];
  sourceGroup: ReminderSourceGroup;
  title: string;
  assigneeLabel: string | null;
  recurrenceLabel: string | null;
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
  active: InboxEntry[];
  history: InboxEntry[];
  sections: InboxSection[];
  counts: {
    due: number;
    today: number;
    upcoming: number;
    delivered: number;
    canceled: number;
    open: number;
  };
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
  if (Number.isNaN(at) || at <= now.getTime()) return "DUE";
  return startOfDay(new Date(at)) === startOfDay(now) ? "TODAY" : "UPCOMING";
}

export function classifyReminderHorizon({
  reminder,
  now,
}: {
  reminder: Pick<ReminderRecord, "status" | "remind_at"> &
    Partial<Pick<ReminderRecord, "snoozed_until" | "delivered_at">>;
  now: Date;
}): ReminderHorizon {
  if (reminder.status === "SENT" || reminder.delivered_at) return "DELIVERED";
  if (reminder.status === "CANCELED") return "CANCELED";

  const at = effectiveReminderAt(reminder as ReminderRecord).getTime();
  if (Number.isNaN(at) || at <= now.getTime()) return "DUE";

  const diffDays = Math.round(
    (startOfDay(new Date(at)) - startOfDay(now)) / DAY_MS,
  );
  if (diffDays <= 0) return "TODAY";
  if (diffDays === 1) return "TOMORROW";
  if (diffDays <= 7) return "NEXT_7_DAYS";
  return "LATER";
}

const DEFAULT_GROUP: Record<
  ReminderRecord["target_type"],
  ReminderSourceGroup
> = {
  TASK: "TASK",
  EVENT: "EVENT",
  CHORE: "CHORE",
  BILL: "BILL",
  DOCUMENT: "DOCUMENT",
  APPLIANCE: "APPLIANCE",
  MEAL: "MEAL",
};

export function resolveTargetTitle({
  reminder,
  tasks,
  events,
  chores = [],
  bills = [],
  documents = [],
  appliances = [],
  meals = [],
}: {
  reminder: Pick<ReminderRecord, "target_type" | "target_id">;
  tasks: ReminderTarget[];
  events: ReminderTarget[];
  chores?: ReminderTarget[];
  bills?: ReminderTarget[];
  documents?: ReminderTarget[];
  appliances?: ReminderTarget[];
  meals?: ReminderTarget[];
}): string {
  const pool: ReminderTarget[] | undefined = {
    TASK: tasks,
    EVENT: events,
    CHORE: chores,
    BILL: bills,
    DOCUMENT: documents,
    APPLIANCE: appliances,
    MEAL: meals,
  }[reminder.target_type];
  const found = pool?.find((item) => item.id === reminder.target_id);
  if (found) return found.title;

  return (
    {
      TASK: "کار حذف‌شده یا غیرقابل دسترس",
      EVENT: "رویداد حذف‌شده یا غیرقابل دسترس",
      CHORE: "کار خانه حذف‌شده یا غیرقابل دسترس",
      BILL: "قبض حذف‌شده یا غیرقابل دسترس",
      DOCUMENT: "مدرک حذف‌شده یا غیرقابل دسترس",
      APPLIANCE: "وسیله حذف‌شده یا غیرقابل دسترس",
      MEAL: "برنامه غذایی حذف‌شده یا غیرقابل دسترس",
    }[reminder.target_type] ?? "مورد حذف‌شده یا غیرقابل دسترس"
  );
}

function toEntry({
  reminder,
  tasks,
  events,
  chores,
  bills,
  documents,
  appliances,
  meals,
  now,
}: {
  reminder: ReminderRecord;
  tasks: ReminderTarget[];
  events: ReminderTarget[];
  chores: ReminderTarget[];
  bills: ReminderTarget[];
  documents: ReminderTarget[];
  appliances: ReminderTarget[];
  meals: ReminderTarget[];
  now: Date;
}): InboxEntry {
  const effective = effectiveReminderAt(reminder);
  const pool: ReminderTarget[] | undefined = {
    TASK: tasks,
    EVENT: events,
    CHORE: chores,
    BILL: bills,
    DOCUMENT: documents,
    APPLIANCE: appliances,
    MEAL: meals,
  }[reminder.target_type];
  const found = pool?.find((item) => item.id === reminder.target_id);

  return {
    id: reminder.id,
    targetId: reminder.target_id,
    state: classifyReminder({ reminder, now }),
    horizon: classifyReminderHorizon({ reminder, now }),
    targetType: reminder.target_type,
    sourceGroup: found?.group ?? DEFAULT_GROUP[reminder.target_type] ?? "TASK",
    title: resolveTargetTitle({
      reminder,
      tasks,
      events,
      chores,
      bills,
      documents,
      appliances,
      meals,
    }),
    assigneeLabel: found?.assigneeLabel ?? null,
    recurrenceLabel: found?.recurrenceLabel ?? null,
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
  chores = [],
  bills = [],
  documents = [],
  appliances = [],
  meals = [],
  now,
}: {
  reminders: ReminderRecord[];
  tasks: ReminderTarget[];
  events: ReminderTarget[];
  chores?: ReminderTarget[];
  bills?: ReminderTarget[];
  documents?: ReminderTarget[];
  appliances?: ReminderTarget[];
  meals?: ReminderTarget[];
  now: Date;
}): ReminderInbox {
  const entries = reminders.map((reminder) =>
    toEntry({
      reminder,
      tasks,
      events,
      chores,
      bills,
      documents,
      appliances,
      meals,
      now,
    }),
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

export function countReminderHorizons(inbox: ReminderInbox) {
  return {
    tomorrow: inbox.active.filter((e) => e.horizon === "TOMORROW").length,
    nextWeek: inbox.active.filter((e) => e.horizon === "NEXT_7_DAYS").length,
  };
}

export function isRepeatedlySnoozed(entry: Pick<InboxEntry, "snoozeCount">) {
  return entry.snoozeCount >= 2;
}

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
