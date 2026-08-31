"use client";

import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/shared/offline/use-online-status";

export function ConnectionStatus() {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <span className="ml-1 inline-flex items-center gap-1.5 rounded-full bg-clay-soft px-2.5 py-1 text-[11px] font-medium text-clay-ink">
      <WifiOff className="size-3" strokeWidth={2} />
      آفلاین
    </span>
  );
}
