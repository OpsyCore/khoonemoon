import { describe, expect, it } from "vitest";
import { notificationSchedule } from "../../../mobile/src/notifications";
import type { ReminderRecord } from "@/features/reminders/types";
function row(data: Partial<ReminderRecord>): ReminderRecord {
  return {
    id: "id",
    user_id: "u",
    household_id: null,
    target_type: "TASK",
    target_id: "x",
    remind_at: "2026-01-01T10:00:00Z",
    status: "PENDING",
    snoozed_until: null,
    snooze_count: 0,
    delivered_at: null,
    created_at: "",
    updated_at: "",
    ...data,
  };
}
describe("local reminder schedule", () => {
  it("uses snoozed timestamps, omits cancelled, delivered, malformed and past entries", () => {
    const now = Date.parse("2026-01-01T09:00:00Z");
    const result = notificationSchedule(
      [
        row({ id: "one" }),
        row({
          id: "two",
          status: "SNOOZED",
          snoozed_until: "2026-01-01T11:00:00Z",
        }),
        row({ status: "CANCELED" }),
        row({ status: "SENT" }),
        row({ delivered_at: "2025-01-01" }),
        row({ remind_at: "invalid" }),
        row({ remind_at: "2025-01-01" }),
      ],
      now,
    );
    expect(result).toEqual([
      {
        id: "one",
        at: Date.parse("2026-01-01T10:00:00Z"),
        source: Date.parse("2026-01-01T10:00:00Z"),
      },
      {
        id: "two",
        at: Date.parse("2026-01-01T11:00:00Z"),
        source: Date.parse("2026-01-01T11:00:00Z"),
      },
    ]);
  });
  it("retains recently due reminders with their original identity for native deduplication", () => {
    const now = Date.parse("2026-01-01T10:05:00Z");
    expect(notificationSchedule([row({ id: "late" })], now)).toEqual([
      {
        id: "late",
        at: now + 2000,
        source: Date.parse("2026-01-01T10:00:00Z"),
      },
    ]);
  });
});

describe("quiet hours on the device", () => {
  it("defers overnight reminders until the next morning", async () => {
    const { afterQuietHours } =
      await import("../../../mobile/src/notifications");
    const date = new Date(2026, 0, 1, 23, 30);
    const after = new Date(
      afterQuietHours(date.getTime(), {
        quiet_hours_enabled: true,
        quiet_hours_start: "22:00",
        quiet_hours_end: "08:00",
      }),
    );
    expect([after.getDate(), after.getHours(), after.getMinutes()]).toEqual([
      2, 8, 0,
    ]);
  });
  it("does not deliver a late reminder during the current quiet hours", () => {
    const due = new Date(2026, 0, 1, 21, 30);
    const now = new Date(2026, 0, 1, 23, 0);
    const result = notificationSchedule(
      [row({ remind_at: due.toISOString() })],
      now.getTime(),
      {
        in_app_enabled: true,
        quiet_hours_enabled: true,
        quiet_hours_start: "22:00",
        quiet_hours_end: "08:00",
      } as import("./types").ReminderPreferenceRecord,
    );
    expect(result[0].source).toBe(due.getTime());
    expect(new Date(result[0].at).getHours()).toBe(8);
    expect(new Date(result[0].at).getDate()).toBe(2);
  });
  it("does not schedule when the user disabled in-app notifications", () => {
    const p = {
      in_app_enabled: false,
    } as import("./types").ReminderPreferenceRecord;
    expect(
      notificationSchedule([row({})], Date.parse("2026-01-01T09:00:00Z"), p),
    ).toEqual([]);
  });
});
