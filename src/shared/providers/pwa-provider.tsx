"use client";

import { useEffect } from "react";

export function PwaProvider() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch {
        // Service worker registration failures are non-fatal for core UX.
      }
    };

    void register();
  }, []);

  return null;
}
