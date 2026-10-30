import type { ReactNode } from "react";
import { BottomNav } from "@/shared/layout/bottom-nav";
import { QuickAddFab } from "@/shared/layout/quick-add-fab";
import { TopBar } from "@/shared/layout/top-bar";

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
      <TopBar />
      <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-4 md:pb-8">
        {children}
      </main>
      <QuickAddFab hasHousehold={hasHousehold} />
      <BottomNav dueReminderCount={dueReminderCount} />
    </div>
  );
}
