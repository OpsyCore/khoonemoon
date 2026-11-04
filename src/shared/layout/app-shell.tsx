import type { ReactNode } from "react";
import { AppMenu } from "@/shared/layout/app-menu";
import { BottomNav } from "@/shared/layout/bottom-nav";
import { QuickAddFab } from "@/shared/layout/quick-add-fab";

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
    <div className="min-h-dvh text-ink">
      <AppMenu dueReminderCount={dueReminderCount} />
      <main className="mx-auto w-full max-w-md px-5 pb-36 pt-20">
        {children}
      </main>
      <QuickAddFab hasHousehold={hasHousehold} />
      <BottomNav dueReminderCount={dueReminderCount} />
    </div>
  );
}
