"use client";

import type { ReactNode } from "react";
import { PwaProvider } from "@/shared/providers/pwa-provider";
import { ThemeProvider } from "@/shared/providers/theme-provider";
import { ConnectionStatus } from "@/shared/layout/connection-status";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <PwaProvider />
      <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center">
        <ConnectionStatus offlineOnly />
      </div>
      {children}
    </ThemeProvider>
  );
}
