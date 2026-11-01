import type { SupabaseClient } from "@supabase/supabase-js";

/** Only Mozilla's gateway is accepted: Chrome's gateway relies on Firebase. */
export function isMozillaPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.hash &&
      (url.hostname === "updates.push.services.mozilla.com" ||
        url.hostname === "push.services.mozilla.com")
    );
  } catch {
    return false;
  }
}
export function decodeApplicationKey(key: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(key))
    throw new Error("کلید عمومی اعلان تنظیم نشده یا نامعتبر است.");
  const raw = atob(
    key
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(key.length / 4) * 4, "="),
  );
  const bytes = Uint8Array.from(raw, (character) => character.charCodeAt(0));
  if (bytes.length !== 65 || bytes[0] !== 4)
    throw new Error("کلید عمومی اعلان نامعتبر است.");
  return bytes;
}
/** Registration stays under the signed-in user's RLS policies. */
export async function enableBrowserPush(
  client: SupabaseClient,
  registration: ServiceWorkerRegistration,
  publicKey: string,
): Promise<void> {
  const key = decodeApplicationKey(publicKey);
  if (
    Notification.permission !== "granted" &&
    (await Notification.requestPermission()) !== "granted"
  )
    throw new Error("مجوز اعلان صادر نشد.");
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("ابتدا وارد حساب شوید.");
  let subscription = await registration.pushManager.getSubscription();
  let created = false;
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key,
    });
    created = true;
  } else {
    const existing = subscription.options.applicationServerKey;
    if (
      !existing ||
      new Uint8Array(existing).length !== key.length ||
      !new Uint8Array(existing).every((byte, index) => byte === key[index])
    )
      throw new Error(
        "کلید اعلان تغییر کرده است؛ ابتدا اعلان این مرورگر را غیرفعال کنید.",
      );
  }
  const input = subscription.toJSON();
  if (
    !isMozillaPushEndpoint(subscription.endpoint) ||
    !input.keys?.p256dh ||
    !input.keys?.auth
  ) {
    if (created) await subscription.unsubscribe();
    throw new Error(
      "این مرورگر از سرویس اعلان مستقل از Firebase پشتیبانی نمی‌کند.",
    );
  }
  const saved = await client.from("push_subscriptions").upsert(
    {
      user_id: data.user.id,
      endpoint: subscription.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      user_agent: navigator.userAgent.slice(0, 300),
      revoked_at: null,
    },
    { onConflict: "endpoint" },
  );
  if (saved.error) {
    if (created) await subscription.unsubscribe();
    throw new Error("ثبت اعلان تأیید نشد؛ اتصال را بررسی کنید.");
  }
  const preference = await client
    .from("notification_preferences")
    .upsert(
      { user_id: data.user.id, web_push_enabled: true },
      { onConflict: "user_id" },
    );
  if (preference.error)
    throw new Error(
      "دستگاه ثبت شد، اما فعال‌سازی تنظیم اعلان تأیید نشد؛ دوباره تلاش کنید.",
    );
}
/** Remove the server association for this device and always unsubscribe locally. */
export async function disableBrowserPush(
  client: SupabaseClient,
  registration: ServiceWorkerRegistration,
): Promise<void> {
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  let failed = false;
  try {
    const revoke = async () => {
      const { data, error } = await client.auth.getUser();
      if (error || !data.user) return false;
      const result = await client
        .from("push_subscriptions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("user_id", data.user.id)
        .eq("endpoint", subscription.endpoint);
      return !result.error;
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      failed = !(await Promise.race([
        revoke(),
        new Promise<false>((resolve) => {
          timer = setTimeout(() => resolve(false), 4000);
        }),
      ]));
    } finally {
      if (timer) clearTimeout(timer);
    }
  } catch {
    failed = true;
  }
  const unsubscribed = await subscription.unsubscribe();
  if (!unsubscribed)
    throw new Error("لغو اعلان مرورگر تأیید نشد؛ دوباره تلاش کنید.");
  if (failed)
    throw new Error(
      "لغو محلی انجام شد، اما لغو سرور تأیید نشد؛ اتصال را بررسی کنید.",
    );
}
