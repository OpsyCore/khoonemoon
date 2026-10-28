import { z } from "zod";

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url("آدرس push نامعتبر است.").max(2000),
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
};

const TARGET_PATH: Record<string, string> = {
  TASK: "/today",
  EVENT: "/calendar",
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
  targetType: "TASK" | "EVENT";
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
