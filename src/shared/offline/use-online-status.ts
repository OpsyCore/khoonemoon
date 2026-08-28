"use client";

import { useSyncExternalStore } from "react";
import {
  getOnlineServerSnapshot,
  getOnlineSnapshot,
  subscribeOnlineStatus,
} from "@/shared/offline/online-status";

export function useOnlineStatus() {
  return useSyncExternalStore(
    subscribeOnlineStatus,
    getOnlineSnapshot,
    getOnlineServerSnapshot,
  );
}
