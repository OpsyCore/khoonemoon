import { describe, expect, it } from "vitest";
import {
  buildReminderInbox,
  classifyReminder,
  daysUntil,
  isRepeatedlySnoozed,
  resolveTargetTitle,
} from "@/features/reminders/inbox";
import type { ReminderRecord } from "@/features/reminders/types";

const NOW = new Date("2026-10-29T12:00:00.000Z");

const TASKS = [
  { id: "t-1", title: "پرداخت قبض" },
  { id: "t-2", title: "خرید نان" },
];
const EVENTS = [{ id: "e-1", title: "جلسهٔ خانواده" }];

function reminder(overrides: Partial<ReminderRecord> = {}): ReminderRecord {
  return {
    id: "r-1",
    target_type: "TASK",
    target_id: "t-1",
    user_id: "u-1",
    household_id: "h-1",
    remind_at: "2026-10-29T18:00:00.000Z",
    status: "PENDING",
    snoozed_until: null,
    snooze_count: 0,
    delivered_at: null,
    created_at: "2026-10-28T00:00:00.000Z",
    updated_at: "2026-10-28T00:00:00.000Z",
    ...overrides,
  };
}

function inbox(reminders: ReminderRecord[]) {
  return buildReminderInbox({
    reminders,
    tasks: TASKS,
    events: EVENTS,
    now: NOW,
  });
}

describe("classifyReminder", () => {
  it("marks a pending reminder in the past as due", () => {
    expect(
      classifyReminder({
        reminder: { status: "PENDING", remind_at: "2026-10-29T09:00:00.000Z" },
        now: NOW,
      }),
    ).toBe("DUE");
  });

  it("marks a later reminder today as today", () => {
    expect(
      classifyReminder({
        reminder: { status: "PENDING", remind_at: "2026-10-29T20:00:00.000Z" },
        now: NOW,
      }),
    ).toBe("TODAY");
  });

  it("marks a reminder on another day as upcoming", () => {
    expect(
      classifyReminder({
        reminder: { status: "PENDING", remind_at: "2026-11-02T08:00:00.000Z" },
        now: NOW,
      }),
    ).toBe("UPCOMING");
  });

  it("uses the snooze target for snoozed reminders", () => {
    expect(
      classifyReminder({
        reminder: {
          status: "SNOOZED",
          remind_at: "2026-10-29T09:00:00.000Z",
          snoozed_until: "2026-10-29T22:00:00.000Z",
        },
        now: NOW,
      }),
    ).toBe("TODAY");
  });

  it("reports sent reminders as delivered even when in the future", () => {
    expect(
      classifyReminder({
        reminder: {
          status: "SENT",
          remind_at: "2026-12-01T09:00:00.000Z",
          delivered_at: "2026-10-29T09:00:00.000Z",
        },
        now: NOW,
      }),
    ).toBe("DELIVERED");
  });

  it("trusts delivered_at over a stale status", () => {
    expect(
      classifyReminder({
        reminder: {
          status: "PENDING",
          remind_at: "2026-10-29T09:00:00.000Z",
          delivered_at: "2026-10-29T09:05:00.000Z",
        },
        now: NOW,
      }),
    ).toBe("DELIVERED");
  });

  it("reports cancelled reminders as canceled", () => {
    expect(
      classifyReminder({
        reminder: { status: "CANCELED", remind_at: "2026-10-29T09:00:00.000Z" },
        now: NOW,
      }),
    ).toBe("CANCELED");
  });

  it("shows a broken timestamp as due instead of hiding it", () => {
    expect(
      classifyReminder({
        reminder: { status: "PENDING", remind_at: "not-a-date" },
        now: NOW,
      }),
    ).toBe("DUE");
  });
});

describe("resolveTargetTitle", () => {
  it("resolves a task title", () => {
    expect(
      resolveTargetTitle({
        reminder: { target_type: "TASK", target_id: "t-2" },
        tasks: TASKS,
        events: EVENTS,
      }),
    ).toBe("خرید نان");
  });

  it("resolves an event title", () => {
    expect(
      resolveTargetTitle({
        reminder: { target_type: "EVENT", target_id: "e-1" },
        tasks: TASKS,
        events: EVENTS,
      }),
    ).toBe("جلسهٔ خانواده");
  });

  it("uses explicit fallbacks for deleted targets", () => {
    expect(
      resolveTargetTitle({
        reminder: { target_type: "TASK", target_id: "gone" },
        tasks: TASKS,
        events: EVENTS,
      }),
    ).toBe("تسک حذف‌شده");

    expect(
      resolveTargetTitle({
        reminder: { target_type: "EVENT", target_id: "gone" },
        tasks: TASKS,
        events: EVENTS,
      }),
    ).toBe("رویداد حذف‌شده");
  });
});

describe("buildReminderInbox", () => {
  it("sorts active reminders soonest first and history newest first", () => {
    const result = inbox([
      reminder({ id: "later", remind_at: "2026-11-05T09:00:00.000Z" }),
      reminder({ id: "soonest", remind_at: "2026-10-29T09:00:00.000Z" }),
      reminder({ id: "today", remind_at: "2026-10-29T20:00:00.000Z" }),
      reminder({
        id: "delivered-old",
        status: "SENT",
        remind_at: "2026-10-20T09:00:00.000Z",
        delivered_at: "2026-10-20T09:01:00.000Z",
      }),
      reminder({
        id: "delivered-new",
        status: "SENT",
        remind_at: "2026-10-27T09:00:00.000Z",
        delivered_at: "2026-10-27T09:01:00.000Z",
      }),
    ]);

    expect(result.active.map((entry) => entry.id)).toEqual([
      "soonest",
      "today",
      "later",
    ]);
    expect(result.history.map((entry) => entry.id)).toEqual([
      "delivered-new",
      "delivered-old",
    ]);
  });

  it("counts every state and reports the open total", () => {
    const result = inbox([
      reminder({ id: "due", remind_at: "2026-10-29T08:00:00.000Z" }),
      reminder({ id: "today", remind_at: "2026-10-29T20:00:00.000Z" }),
      reminder({ id: "up", remind_at: "2026-11-10T20:00:00.000Z" }),
      reminder({
        id: "sent",
        status: "SENT",
        delivered_at: "2026-10-25T10:00:00.000Z",
      }),
      reminder({ id: "canceled", status: "CANCELED" }),
    ]);

    expect(result.counts).toEqual({
      due: 1,
      today: 1,
      upcoming: 1,
      delivered: 1,
      canceled: 1,
      open: 3,
    });
  });

  it("exposes the soonest open reminder as nextAt", () => {
    const result = inbox([
      reminder({ id: "a", remind_at: "2026-10-30T09:00:00.000Z" }),
      reminder({ id: "b", remind_at: "2026-10-29T09:00:00.000Z" }),
    ]);

    expect(result.nextAt).toBe(
      new Date("2026-10-29T09:00:00.000Z").toISOString(),
    );
  });

  it("omits empty sections but keeps the ones with content", () => {
    const result = inbox([
      reminder({ id: "due", remind_at: "2026-10-29T08:00:00.000Z" }),
    ]);

    expect(result.sections.map((section) => section.state)).toEqual(["DUE"]);
  });

  it("returns an empty, safe inbox with no reminders", () => {
    const result = inbox([]);

    expect(result).toEqual({
      active: [],
      history: [],
      sections: [],
      counts: {
        due: 0,
        today: 0,
        upcoming: 0,
        delivered: 0,
        canceled: 0,
        open: 0,
      },
      nextAt: null,
    });
  });

  it("carries the resolved title and snooze count into entries", () => {
    const result = inbox([
      reminder({
        id: "snoozed",
        status: "SNOOZED",
        snoozed_until: "2026-10-29T23:00:00.000Z",
        snooze_count: 3,
        target_id: "t-2",
      }),
    ]);

    expect(result.active[0]).toMatchObject({
      id: "snoozed",
      title: "خرید نان",
      state: "TODAY",
      snoozeCount: 3,
    });
    expect(isRepeatedlySnoozed(result.active[0])).toBe(true);
  });

  it("keeps a reminder with a broken timestamp visible as due", () => {
    const result = inbox([reminder({ remind_at: "garbage" })]);

    expect(result.counts.due).toBe(1);
    // Falls back to the raw value rather than an invalid ISO string.
    expect(result.active[0].effectiveAt).toBe("garbage");
  });
});

describe("isRepeatedlySnoozed", () => {
  it("flags two or more snoozes", () => {
    expect(isRepeatedlySnoozed({ snoozeCount: 0 })).toBe(false);
    expect(isRepeatedlySnoozed({ snoozeCount: 1 })).toBe(false);
    expect(isRepeatedlySnoozed({ snoozeCount: 2 })).toBe(true);
  });
});

describe("daysUntil", () => {
  it("counts whole days from today", () => {
    expect(daysUntil({ iso: "2026-10-29T22:00:00.000Z", now: NOW })).toBe(0);
    expect(daysUntil({ iso: "2026-10-30T08:00:00.000Z", now: NOW })).toBe(1);
    expect(daysUntil({ iso: "2026-10-27T08:00:00.000Z", now: NOW })).toBe(-2);
  });

  it("returns null for an invalid date", () => {
    expect(daysUntil({ iso: "nope", now: NOW })).toBeNull();
  });
});
