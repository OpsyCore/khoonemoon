import type { ReactNode } from "react";
import { BottomNav } from "@/shared/layout/bottom-nav";
import { ConnectionStatus } from "@/shared/layout/connection-status";
import { QuickAddFab } from "@/shared/layout/quick-add-fab";

/**
 * Reference shell — no global navbar: every screen opens directly with its
 * own page header, like the reference. The column keeps the reference's
 * mobile proportions and generous side margins on every viewport.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center">
        <ConnectionStatus />
      </div>
      <main className="mx-auto w-full max-w-md px-5 pb-36 pt-7">
        {children}
      </main>
      <QuickAddFab />
      <BottomNav />
    </div>
  );
}
