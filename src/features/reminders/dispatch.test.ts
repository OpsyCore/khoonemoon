import { describe, expect, it } from "vitest";
import {
  buildDispatchPlan,
  effectiveReminderAt,
  selectDueReminders,
  shouldDeferForQuietHours,
} from "./dispatch";
import type { ReminderRecord } from "./types";

const now = new Date("2026-10-28T12:00:00.000Z");

function reminder(overrides: Partial<ReminderRecord>): ReminderRecord {
  return {
    id: "reminder-1",
    target_type: "TASK",
    target_id: "task-1",
    user_id: "user-a",
    household_id: "household-1",
    remind_at: "2026-10-28T11:00:00.000Z",
    status: "PENDING",
    snoozed_until: null,
    snooze_count: 0,
    delivered_at: null,
    created_at: "2026-10-27T00:00:00.000Z",
    updated_at: "2026-10-27T00:00:00.000Z",
    ...overrides,
  };
}

describe("effectiveReminderAt", () => {
  it("uses snoozed_until for snoozed reminders", () => {
    const value = effectiveReminderAt(
      reminder({
        status: "SNOOZED",
        snoozed_until: "2026-10-28T12:30:00.000Z",
      }),
    );

    expect(value.toISOString()).toBe("2026-10-28T12:30:00.000Z");
  });

  it("falls back to remind_at when no snooze target is set", () => {
    expect(
      effectiveReminderAt(reminder({ status: "SNOOZED" })).toISOString(),
    ).toBe("2026-10-28T11:00:00.000Z");
  });
});

describe("selectDueReminders", () => {
  it("returns only reminders whose effective time has passed", () => {
    const due = selectDueReminders({
      reminders: [
        reminder({ id: "past" }),
        reminder({ id: "future", remind_at: "2026-10-28T13:00:00.000Z" }),
        reminder({ id: "sent", status: "SENT" }),
        reminder({ id: "canceled", status: "CANCELED" }),
      ],
      now,
    });

    expect(due.map((item) => item.id)).toEqual(["past"]);
  });

  it("orders due reminders by effective time", () => {
    const due = selectDueReminders({
      reminders: [
        reminder({ id: "later", remind_at: "2026-10-28T11:30:00.000Z" }),
        reminder({ id: "earlier", remind_at: "2026-10-28T10:00:00.000Z" }),
      ],
      now,
    });

    expect(due.map((item) => item.id)).toEqual(["earlier", "later"]);
  });

  it("treats a snoozed reminder as due only after its snooze target", () => {
    const due = selectDueReminders({
      reminders: [
        reminder({
          id: "snoozed-later",
          status: "SNOOZED",
          remind_at: "2026-10-28T09:00:00.000Z",
          snoozed_until: "2026-10-28T12:30:00.000Z",
        }),
        reminder({
          id: "snoozed-past",
          status: "SNOOZED",
          remind_at: "2026-10-28T09:00:00.000Z",
          snoozed_until: "2026-10-28T11:45:00.000Z",
        }),
      ],
      now,
    });

    expect(due.map((item) => item.id)).toEqual(["snoozed-past"]);
  });
});

describe("shouldDeferForQuietHours", () => {
  it("defers inside a same-day window", () => {
    expect(
      shouldDeferForQuietHours({
        now: new Date("2026-10-28T14:00:00"),
        quietHoursEnabled: true,
        quietHoursStart: "13:00",
        quietHoursEnd: "16:00",
      }),
    ).toBe(true);
  });

  it("handles windows that cross midnight", () => {
    expect(
      shouldDeferForQuietHours({
        now: new Date("2026-10-28T23:30:00"),
        quietHoursEnabled: true,
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
      }),
    ).toBe(true);

    expect(
      shouldDeferForQuietHours({
        now: new Date("2026-10-28T12:00:00"),
        quietHoursEnabled: true,
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
      }),
    ).toBe(false);
  });

  it("never defers when quiet hours are disabled or unset", () => {
    expect(
      shouldDeferForQuietHours({
        now: new Date("2026-10-28T23:30:00"),
        quietHoursEnabled: false,
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
      }),
    ).toBe(false);

    expect(
      shouldDeferForQuietHours({
        now: new Date("2026-10-28T23:30:00"),
        quietHoursEnabled: true,
        quietHoursStart: null,
        quietHoursEnd: null,
      }),
    ).toBe(false);
  });
});

describe("buildDispatchPlan", () => {
  it("sends everything that is due when quiet hours are off", () => {
    const plan = buildDispatchPlan({
      reminders: [reminder({ id: "a" })],
      now,
      quietHours: { enabled: false, start: null, end: null },
    });

    expect(plan.toSend).toHaveLength(1);
    expect(plan.deferred).toHaveLength(0);
  });

  it("defers due reminders during quiet hours instead of dropping them", () => {
    const plan = buildDispatchPlan({
      reminders: [reminder({ id: "a" })],
      now: new Date("2026-10-28T14:00:00"),
      quietHours: { enabled: true, start: "13:00", end: "16:00" },
    });

    expect(plan.toSend).toHaveLength(0);
    expect(plan.deferred.map((item) => item.id)).toEqual(["a"]);
  });
});
