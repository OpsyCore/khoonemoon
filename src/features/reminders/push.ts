import { z } from "zod";
import type { ReminderTargetType } from "./types";

/** Allow only known browser push gateways. Subscriptions are user-controlled;
 * never let a background sender make arbitrary requests (SSRF). */
export function isSafePushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    const host = url.hostname.toLowerCase();
    const known =
      host === "fcm.googleapis.com" ||
      host === "updates.push.services.mozilla.com" ||
      host === "push.services.mozilla.com" ||
      host.endsWith(".push.apple.com") ||
      host.endsWith(".notify.windows.com");
    return (
      url.protocol === "https:" &&
      known &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.hash
    );
  } catch {
    return false;
  }
}

export const pushSubscriptionSchema = z.object({
  endpoint: z
    .string()
    .url("آدرس push نامعتبر است.")
    .max(2000)
    .refine(isSafePushEndpoint, "سرویس push پشتیبانی نمی‌شود."),
  keys: z.object({
    p256dh: z.string().min(20).max(200),
    auth: z.string().min(8).max(100),
  }),
});

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

export type PushPayloadInput = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

const TARGET_LABEL: Record<string, string> = {
  TASK: "تسک",
  EVENT: "رویداد",
  CHORE: "کار خانه",
  BILL: "قبض",
};

const TARGET_PATH: Record<string, string> = {
  TASK: "/today",
  EVENT: "/calendar",
  CHORE: "/lists",
  BILL: "/finance",
};

/**
 * Builds the notification shown on the device. Kept pure so it can be unit
 * tested and reused by the service worker payload contract.
 */
export function buildPushPayload({
  targetType,
  remindAt,
  now = new Date(),
}: {
  targetType: ReminderTargetType;
  remindAt: string | Date;
  now?: Date;
}): PushPayload {
  const label = TARGET_LABEL[targetType] ?? "یادآور";
  const remindDate = remindAt instanceof Date ? remindAt : new Date(remindAt);

  const timeLabel = Number.isNaN(remindDate.getTime())
    ? ""
    : new Intl.DateTimeFormat("fa-IR", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(remindDate);

  const isPast = remindDate.getTime() <= now.getTime();

  return {
    title: `یادآور ${label}`,
    body: isPast
      ? `زمان یادآوری ${label} رسیده است${timeLabel ? ` (${timeLabel})` : ""}.`
      : `یادآوری برای ${timeLabel || "زمان مقرر"}.`,
    url: TARGET_PATH[targetType] ?? "/today",
    tag: `reminder-${targetType.toLowerCase()}`,
  };
}

/** Endpoints that the push service reports as gone must be revoked. */
export function isExpiredSubscriptionError(statusCode: number | undefined) {
  return statusCode === 404 || statusCode === 410;
}
