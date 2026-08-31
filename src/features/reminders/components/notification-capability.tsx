"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardDescription, CardTitle } from "@/shared/ui/card";

function getSupport() {
  if (typeof window === "undefined") {
    return {
      notifications: false,
      serviceWorker: false,
      pushManager: false,
    };
  }

  return {
    notifications: "Notification" in window,
    serviceWorker: "serviceWorker" in navigator,
    pushManager: "PushManager" in window,
  };
}

export function NotificationCapability() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );

  const support = useMemo(() => getSupport(), []);

  const requestPermission = async () => {
    if (!support.notifications) return;
    const result = await Notification.requestPermission();
    setPermission(result);
  };

  return (
    <Card className="space-y-3 p-5">
      <CardTitle>وضعیت اعلان‌های وب / PWA</CardTitle>
      <CardDescription>
        این بخش فقط قابلیت و مجوز اعلان را بررسی می‌کند. در مرورگر، اجرای دقیق
        یادآور در پس‌زمینه همیشه تضمین‌شده نیست.
      </CardDescription>

      <ul className="divide-y divide-line text-sm">
        {[
          { label: "Notification API", ok: support.notifications },
          { label: "Service Worker", ok: support.serviceWorker },
          { label: "Push Manager", ok: support.pushManager },
        ].map((row) => (
          <li
            key={row.label}
            className="flex items-center justify-between py-2.5"
          >
            <span className="text-ink-soft">{row.label}</span>
            <Badge tone={row.ok ? "success" : "warning"}>
              {row.ok ? "پشتیبانی می‌شود" : "پشتیبانی نمی‌شود"}
            </Badge>
          </li>
        ))}
        <li className="flex items-center justify-between py-2.5">
          <span className="text-ink-soft">وضعیت مجوز</span>
          <Badge
            tone={
              permission === "granted"
                ? "success"
                : permission === "denied"
                  ? "danger"
                  : "neutral"
            }
          >
            {permission === "granted"
              ? "فعال"
              : permission === "denied"
                ? "رد شده"
                : "نامشخص"}
          </Badge>
        </li>
      </ul>

      {!support.notifications ? (
        <p className="text-sm text-warn-ink">
          مرورگر شما اعلان وب را پشتیبانی نمی‌کند. یادآورها همچنان درون برنامه
          قابل مشاهده خواهند بود.
        </p>
      ) : (
        <Button
          onClick={requestPermission}
          disabled={permission === "granted"}
          variant={permission === "granted" ? "secondary" : "primary"}
        >
          {permission === "granted"
            ? "مجوز اعلان فعال است"
            : "درخواست مجوز اعلان"}
        </Button>
      )}
    </Card>
  );
}
