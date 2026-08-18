import { describe, expect, it } from "vitest";
import {
  applySnooze,
  buildReminderTimes,
  calculateUpcomingReminders,
  isInQuietHours,
} from "@/features/reminders/calculations";

describe("reminder calculations", () => {
  it("builds multiple reminder timestamps from offsets", () => {
    const times = buildReminderTimes({
      baseDateTime: "2026-05-20T12:00:00.000Z",
      offsetsMinutes: [60, 10],
    });

    expect(times).toHaveLength(2);
    expect(times[0]).toBe("2026-05-20T11:00:00.000Z");
    expect(times[1]).toBe("2026-05-20T11:50:00.000Z");
  });

  it("normalizes timezone-offset input to canonical UTC timestamps", () => {
    const times = buildReminderTimes({
      baseDateTime: "2026-05-20T08:00:00+03:30",
      offsetsMinutes: [30],
    });

    expect(times[0]).toBe("2026-05-20T04:00:00.000Z");
  });

  it("calculates upcoming reminders with snoozed effective time", () => {
    const reminders = [
      {
        id: "r1",
        target_type: "TASK",
        target_id: "t1",
        user_id: "u1",
        household_id: null,
        remind_at: "2026-05-20T12:00:00.000Z",
        status: "PENDING",
        snoozed_until: null,
        snooze_count: 0,
        delivered_at: null,
        created_at: "2026-05-20T10:00:00.000Z",
        updated_at: "2026-05-20T10:00:00.000Z",
      },
      {
        id: "r2",
        target_type: "EVENT",
        target_id: "e1",
        user_id: "u1",
        household_id: null,
        remind_at: "2026-05-20T12:30:00.000Z",
        status: "SNOOZED",
        snoozed_until: "2026-05-20T13:00:00.000Z",
        snooze_count: 1,
        delivered_at: null,
        created_at: "2026-05-20T10:00:00.000Z",
        updated_at: "2026-05-20T10:00:00.000Z",
      },
    ] as const;

    const upcoming = calculateUpcomingReminders({
      reminders: reminders as never,
      now: new Date("2026-05-20T11:30:00.000Z"),
      horizonHours: 3,
    });

    expect(upcoming).toHaveLength(2);
    expect(upcoming[1]?.effective_at).toBe("2026-05-20T13:00:00.000Z");
  });

  it("applies snooze with incremented counter", () => {
    const result = applySnooze({
      reminder: { status: "PENDING", snooze_count: 2 },
      minutes: 15,
      now: new Date("2026-05-20T10:00:00.000Z"),
    });

    expect(result.status).toBe("SNOOZED");
    expect(result.snooze_count).toBe(3);
    expect(result.snoozed_until).toBe("2026-05-20T10:15:00.000Z");
  });

  it("detects quiet hours even across midnight", () => {
    expect(
      isInQuietHours({
        now: new Date("2026-05-20T22:30:00"),
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
      }),
    ).toBe(true);

    expect(
      isInQuietHours({
        now: new Date("2026-05-20T10:30:00"),
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
      }),
    ).toBe(false);
  });
});
