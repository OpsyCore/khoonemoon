/// <reference types="vite/client" />
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { disableBrowserPush, enableBrowserPush } from "./web-push";

export function BrowserPushSettings({
  client,
  onChanged,
}: {
  client: SupabaseClient;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [key, setKey] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void client
      .rpc("standalone_push_public_key")
      .then(({ data, error }) => {
        if (active)
          setKey(
            !error &&
              typeof data === "string" &&
              /^[A-Za-z0-9_-]{87}$/.test(data)
              ? data
              : null,
          );
      })
      .catch(() => {
        if (active) setKey(null);
      });
    return () => {
      active = false;
    };
  }, [client]);
  const configured = !!key;
  const supported =
    typeof window !== "undefined" &&
    window.isSecureContext &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;
  async function run(enable: boolean) {
    setBusy(true);
    setMessage("");
    try {
      // Invoke permission synchronously within the click handler, before waiting for service-worker I/O.
      const permission =
        enable && Notification.permission !== "granted"
          ? Notification.requestPermission()
          : null;
      if (permission && (await permission) !== "granted")
        throw new Error("مجوز اعلان صادر نشد.");
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration)
        throw new Error("برنامه هنوز آماده نیست؛ صفحه را تازه کنید.");
      if (enable && key) await enableBrowserPush(client, registration, key);
      else await disableBrowserPush(client, registration);
      onChanged();
      setMessage(
        enable
          ? "این مرورگر ثبت شد؛ دریافت به سرویس اعلان و اتصال وابسته است."
          : "اعلان این مرورگر غیرفعال شد.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "تنظیم اعلان ناموفق بود.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!supported) return <p>اعلان مرورگر در این محیط پشتیبانی نمی‌شود.</p>;
  return (
    <div>
      <p>
        {configured
          ? "اعلان وب بدون Firebase تنها با سرویس پشتیبانی‌شدهٔ مرورگر کار می‌کند؛ زمان تحویل تضمین‌شده نیست."
          : "سرویس اعلان وب مستقل هنوز تنظیم و مستقر نشده است."}
      </p>
      <button
        type="button"
        disabled={busy || !configured}
        onClick={() => void run(true)}
      >
        فعال‌سازی اعلان این مرورگر
      </button>{" "}
      <button
        type="button"
        className="minor"
        disabled={busy}
        onClick={() => void run(false)}
      >
        غیرفعال‌سازی اعلان این مرورگر
      </button>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
