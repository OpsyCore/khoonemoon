"use client";

import { useOnlineStatus } from "@/shared/offline/use-online-status";
import { Badge } from "@/shared/ui/badge";

export function ConnectionStatus() {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return <Badge tone="success">آنلاین</Badge>;
  }

  return <Badge tone="danger">آفلاین</Badge>;
}
