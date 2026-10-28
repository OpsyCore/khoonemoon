import webpush from "web-push";
import { isExpiredSubscriptionError } from "@/features/reminders/push";

type VapidConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

let configuredKey: string | null = null;

/**
 * Web Push needs a VAPID key pair. The public half is shipped to the browser
 * (`NEXT_PUBLIC_...`), the private half stays on the server.
 *
 * Returns `null` when push is not configured so callers can degrade to in-app
 * reminders instead of throwing.
 */
export function getVapidConfig(): VapidConfig | null {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:hello@khoonemoon.app";

  if (!publicKey || !privateKey) return null;

  return { publicKey, privateKey, subject };
}

function ensureConfigured(config: VapidConfig) {
  if (configuredKey === config.publicKey) return;

  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  configuredKey = config.publicKey;
}

export type StoredSubscription = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushSendResult =
  | { status: "sent" }
  | { status: "expired" }
  | { status: "failed"; message: string }
  | { status: "not_configured" };

export async function sendPushNotification({
  subscription,
  payload,
}: {
  subscription: StoredSubscription;
  payload: unknown;
}): Promise<PushSendResult> {
  const config = getVapidConfig();

  if (!config) return { status: "not_configured" };

  ensureConfigured(config);

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 12, urgency: "normal" },
    );

    return { status: "sent" };
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;

    if (isExpiredSubscriptionError(statusCode)) {
      return { status: "expired" };
    }

    return {
      status: "failed",
      message: error instanceof Error ? error.message : "unknown push error",
    };
  }
}
