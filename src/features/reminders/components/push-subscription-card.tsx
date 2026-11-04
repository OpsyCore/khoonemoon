"use client";

import { BellRing, BellOff, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardDescription, CardTitle } from "@/shared/ui/card";

type PushState = "loading" | "unsupported" | "unconfigured" | "off" | "on";

function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);

  for (let i = 0; i < raw.length; i += 1) {
    bytes[i] = raw.charCodeAt(i);
  }

  return bytes.buffer as ArrayBuffer;
}

export function PushSubscriptionCard() {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [permission, setPermission] =
    useState<NotificationPermission>("default");

  const supported = useMemo(() => {
    if (typeof window === "undefined") return false;
    return (
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
    );
  }, []);

  useEffect(() => {
    const detect = async () => {
      if (!supported) {
        setState("unsupported");
        return;
      }

      if (!vapidPublicKey) {
        setState("unconfigured");
        return;
      }

      setPermission(Notification.permission);

      try {
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        setState(existing ? "on" : "off");
      } catch {
        setState("off");
      }
    };

    void detect();
  }, [supported, vapidPublicKey]);

  const subscribe = async () => {
    setBusy(true);
    setMessage(null);

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result !== "granted") {
        setMessage("برای دریافت اعلان، اجازه مرورگر لازم است.");
        return;
      }

      const registration = await navigator.serviceWorker.ready;

      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToArrayBuffer(vapidPublicKey),
        }));

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        setMessage(payload?.message ?? "ثبت دستگاه ناموفق بود.");
        return;
      }

      setState("on");
      setMessage("این دستگاه برای اعلان‌های یادآور ثبت شد.");
    } catch {
      setMessage(
        "فعال‌سازی اعلان ناموفق بود. اگر برنامه را نصب کرده‌اید دوباره تلاش کنید.",
      );
    } finally {
      setBusy(false);
    }
  };

  const unsubscribe = async () => {
    setBusy(true);
    setMessage(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await fetch(
          `/api/push/subscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`,
          { method: "DELETE" },
        );
        await subscription.unsubscribe();
      }

      setState("off");
      setMessage("اعلان این دستگاه خاموش شد.");
    } catch {
      setMessage("خاموش کردن اعلان ناموفق بود.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {state === "on" ? (
            <BellRing className="size-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <BellOff className="size-4 text-muted" />
          )}
          <CardTitle>اعلان‌های یادآور روی این دستگاه</CardTitle>
        </div>

        {state === "on" ? (
          <Badge tone="success">فعال</Badge>
        ) : state === "loading" ? (
          <Loader2 className="size-4 animate-spin text-zinc-400" />
        ) : (
          <Badge tone="neutral">غیرفعال</Badge>
        )}
      </div>

      <CardDescription>
        با فعال‌سازی، یادآورها حتی وقتی برنامه باز نیست روی گوشی نمایش داده
        می‌شوند. در هر دستگاه جداگانه باید فعال شود.
      </CardDescription>

      {state === "unsupported" ? (
        <p className="text-sm text-amber-700 dark:text-amber-300">
          این مرورگر از اعلان وب پشتیبانی نمی‌کند. یادآورها همچنان در صفحه
          «امروز» نمایش داده می‌شوند.
        </p>
      ) : null}

      {state === "unconfigured" ? (
        <p className="text-sm text-amber-700 dark:text-amber-300">
          کلید عمومی اعلان (VAPID) روی سرور تنظیم نشده است؛ اعلان‌ها فقط
          درون‌برنامه‌ای خواهند بود.
        </p>
      ) : null}

      {state === "off" || state === "on" ? (
        <>
          {permission === "denied" ? (
            <p className="text-sm text-rose-600 dark:text-rose-400">
              اجازه اعلان در تنظیمات مرورگر رد شده است؛ برای فعال‌سازی دوباره،
              آن را از تنظیمات سایت تغییر دهید.
            </p>
          ) : null}

          <Button
            variant={state === "on" ? "ghost" : "primary"}
            isLoading={busy}
            disabled={permission === "denied" && state !== "on"}
            onClick={() => void (state === "on" ? unsubscribe() : subscribe())}
          >
            {state === "on" ? "خاموش کردن اعلان این دستگاه" : "فعال‌سازی اعلان"}
          </Button>
        </>
      ) : null}

      {message ? <p className="text-xs text-ink-soft">{message}</p> : null}
    </Card>
  );
}
