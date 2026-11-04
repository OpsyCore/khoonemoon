import { describe, expect, it } from "vitest";
import {
  buildPushPayload,
  isExpiredSubscriptionError,
  isSafePushEndpoint,
  pushSubscriptionSchema,
} from "./push";

const validSubscription = {
  endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
  keys: {
    p256dh:
      "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
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

describe("push endpoint safety", () => {
  it("allows supported HTTPS browser push gateways only", () => {
    expect(isSafePushEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(
      true,
    );
    expect(
      isSafePushEndpoint(
        "https://updates.push.services.mozilla.com/wpush/v2/a",
      ),
    ).toBe(true);
    expect(isSafePushEndpoint("https://web.push.apple.com/Q/a")).toBe(true);
    for (const endpoint of [
      "http://fcm.googleapis.com/a",
      "https://fcm.googleapis.com.evil.test/a",
      "https://fcm.googleapis.com@127.0.0.1/a",
      "https://fcm.googleapis.com:8443/a",
      "https://127.0.0.1/a",
      "https://169.254.169.254/a",
      "https://evil.test/a",
    ]) {
      expect(isSafePushEndpoint(endpoint)).toBe(false);
      expect(
        pushSubscriptionSchema.safeParse({ ...validSubscription, endpoint })
          .success,
      ).toBe(false);
    }
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

  it("routes chore and bill notifications correctly", () => {
    expect(
      buildPushPayload({ targetType: "CHORE", remindAt: now, now }).url,
    ).toBe("/lists");
    expect(
      buildPushPayload({ targetType: "BILL", remindAt: now, now }).url,
    ).toBe("/finance");
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
