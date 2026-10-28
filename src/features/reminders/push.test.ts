import { describe, expect, it } from "vitest";
import {
  buildPushPayload,
  isExpiredSubscriptionError,
  pushSubscriptionSchema,
} from "./push";

const validSubscription = {
  endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
  keys: {
    p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
    auth: "tBHItJI5svbpez7KI4CCXg",
  },
};

describe("pushSubscriptionSchema", () => {
  it("accepts a browser subscription object", () => {
    expect(pushSubscriptionSchema.safeParse(validSubscription).success).toBe(
      true,
    );
  });

  it("rejects a non-url endpoint", () => {
    expect(
      pushSubscriptionSchema.safeParse({
        ...validSubscription,
        endpoint: "not-a-url",
      }).success,
    ).toBe(false);
  });

  it("rejects missing keys", () => {
    expect(
      pushSubscriptionSchema.safeParse({ endpoint: validSubscription.endpoint })
        .success,
    ).toBe(false);
  });

  it("rejects oversized endpoints", () => {
    expect(
      pushSubscriptionSchema.safeParse({
        ...validSubscription,
        endpoint: `https://example.com/${"x".repeat(2100)}`,
      }).success,
    ).toBe(false);
  });
});

describe("buildPushPayload", () => {
  const now = new Date("2026-10-28T12:00:00.000Z");

  it("builds a Persian payload for a due task reminder", () => {
    const payload = buildPushPayload({
      targetType: "TASK",
      remindAt: "2026-10-28T11:00:00.000Z",
      now,
    });

    expect(payload.title).toContain("تسک");
    expect(payload.body).toContain("رسیده");
    expect(payload.url).toBe("/today");
    expect(payload.tag).toBe("reminder-task");
  });

  it("routes event reminders to the calendar", () => {
    const payload = buildPushPayload({
      targetType: "EVENT",
      remindAt: "2026-10-29T09:00:00.000Z",
      now,
    });

    expect(payload.url).toBe("/calendar");
    expect(payload.title).toContain("رویداد");
  });

  it("survives an invalid date without throwing", () => {
    const payload = buildPushPayload({
      targetType: "TASK",
      remindAt: "not-a-date",
      now,
    });

    expect(payload.body.length).toBeGreaterThan(0);
  });
});

describe("isExpiredSubscriptionError", () => {
  it("treats 404/410 as gone", () => {
    expect(isExpiredSubscriptionError(404)).toBe(true);
    expect(isExpiredSubscriptionError(410)).toBe(true);
  });

  it("keeps other failures retryable", () => {
    expect(isExpiredSubscriptionError(500)).toBe(false);
    expect(isExpiredSubscriptionError(undefined)).toBe(false);
  });
});
