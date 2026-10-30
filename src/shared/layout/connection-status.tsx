"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/shared/ui/badge";

export function ConnectionStatus({
  offlineOnly = false,
}: {
  offlineOnly?: boolean;
}) {
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof navigator === "undefined") return true;
    return navigator.onLine;
  });

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  if (isOnline && offlineOnly) return null;

  if (isOnline) {
    return <Badge tone="success">آنلاین</Badge>;
  }

  return <Badge tone="danger">آفلاین</Badge>;
}
