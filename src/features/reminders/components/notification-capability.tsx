"use client";

import { useMemo, useState } from "react";
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
    <Card className="space-y-3">
      <CardTitle>وضعیت اعلان‌های وب / PWA</CardTitle>
      <CardDescription>
        این بخش فقط قابلیت و مجوز اعلان را بررسی می‌کند. در مرورگر، اجرای دقیق
        یادآور در پس‌زمینه همیشه تضمین‌شده نیست.
      </CardDescription>

      <ul className="space-y-1 text-sm text-zinc-700 dark:text-zinc-200">
        <li>
          Notification API:{" "}
          {support.notifications ? "پشتیبانی می‌شود" : "پشتیبانی نمی‌شود"}
        </li>
        <li>
          Service Worker:{" "}
          {support.serviceWorker ? "پشتیبانی می‌شود" : "پشتیبانی نمی‌شود"}
        </li>
        <li>
          Push Manager:{" "}
          {support.pushManager ? "پشتیبانی می‌شود" : "پشتیبانی نمی‌شود"}
        </li>
        <li>وضعیت مجوز: {permission}</li>
      </ul>

      {!support.notifications ? (
        <p className="text-sm text-amber-700 dark:text-amber-300">
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
