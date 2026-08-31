"use client";

import { offlineUserMessage } from "@/shared/offline/online-status";
import { useOnlineStatus } from "@/shared/offline/use-online-status";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardDescription, CardTitle } from "@/shared/ui/card";

export function ConnectionSettingsCard() {
  const isOnline = useOnlineStatus();

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle>اتصال</CardTitle>
          <CardDescription>
            وضعیت شبکه همین دستگاه است؛ دادهٔ جعلی یا صف آفلاین جداگانه نداریم.
          </CardDescription>
        </div>
        <Badge tone={isOnline ? "success" : "danger"}>
          {isOnline ? "آنلاین" : "آفلاین"}
        </Badge>
      </div>
      {!isOnline ? (
        <p className="text-sm text-danger-ink">{offlineUserMessage()}</p>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => window.location.reload()}
      >
        تلاش دوباره
      </Button>
    </Card>
  );
}
