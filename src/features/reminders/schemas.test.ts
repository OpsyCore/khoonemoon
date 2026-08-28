import { describe, expect, it } from "vitest";
import {
  createRemindersSchema,
  reminderPreferencesSchema,
  snoozeReminderSchema,
} from "@/features/reminders/schemas";

const targetId = "11111111-1111-4111-8111-111111111111";

describe("reminder schemas", () => {
  it("accepts TASK and EVENT targets and rejects others", () => {
    expect(
      createRemindersSchema.safeParse({
        targetType: "TASK",
        targetId,
        baseDateTime: "2026-08-28T10:00:00.000Z",
        offsets: [{ minutesBefore: 30 }],
      }).success,
    ).toBe(true);

    expect(
      createRemindersSchema.safeParse({
        targetType: "EVENT",
        targetId,
        baseDateTime: "2026-08-28T10:00:00.000Z",
        offsets: [{ minutesBefore: 0 }],
      }).success,
    ).toBe(true);

    expect(
      createRemindersSchema.safeParse({
        targetType: "FINANCE",
        targetId,
        baseDateTime: "2026-08-28T10:00:00.000Z",
        offsets: [{ minutesBefore: 30 }],
      }).success,
    ).toBe(false);
  });

  it("requires at least one offset and at most ten", () => {
    expect(
      createRemindersSchema.safeParse({
        targetType: "TASK",
        targetId,
        baseDateTime: "2026-08-28T10:00:00.000Z",
        offsets: [],
      }).success,
    ).toBe(false);

    expect(
      createRemindersSchema.safeParse({
        targetType: "TASK",
        targetId,
        baseDateTime: "2026-08-28T10:00:00.000Z",
        offsets: Array.from({ length: 11 }, () => ({ minutesBefore: 1 })),
      }).success,
    ).toBe(false);
  });

  it("validates snooze minutes", () => {
    expect(
      snoozeReminderSchema.safeParse({ reminderId: targetId, minutes: 15 })
        .success,
    ).toBe(true);
    expect(
      snoozeReminderSchema.safeParse({ reminderId: targetId, minutes: 0 })
        .success,
    ).toBe(false);
  });

  it("requires quiet-hour bounds when quiet hours are enabled", () => {
    expect(
      reminderPreferencesSchema.safeParse({
        inAppEnabled: true,
        webPushEnabled: false,
        quietHoursEnabled: true,
        quietHoursStart: null,
        quietHoursEnd: null,
      }).success,
    ).toBe(false);

    expect(
      reminderPreferencesSchema.safeParse({
        inAppEnabled: true,
        webPushEnabled: false,
        quietHoursEnabled: true,
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
      }).success,
    ).toBe(true);
  });
});
