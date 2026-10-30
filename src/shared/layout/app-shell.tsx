import type { ReactNode } from "react";
import { BottomNav } from "@/shared/layout/bottom-nav";
import { QuickAddFab } from "@/shared/layout/quick-add-fab";
import { ConnectionStatus } from "@/shared/layout/connection-status";

export function AppShell({
  children,
  hasHousehold = false,
  dueReminderCount = 0,
}: {
  children: ReactNode;
  hasHousehold?: boolean;
  dueReminderCount?: number;
}) {
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center">
        <ConnectionStatus offlineOnly />
      </div>
      <main className="mx-auto w-full max-w-md px-5 pb-36 pt-7">
        {children}
      </main>
      <QuickAddFab hasHousehold={hasHousehold} />
      <BottomNav dueReminderCount={dueReminderCount} />
    </div>
  );
}
