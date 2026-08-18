"use client";

import type { ReactNode } from "react";
import { PwaProvider } from "@/shared/providers/pwa-provider";
import { ThemeProvider } from "@/shared/providers/theme-provider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <PwaProvider />
      {children}
    </ThemeProvider>
  );
}
