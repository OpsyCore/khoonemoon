import type { ReactNode } from "react";
import { BottomNav } from "@/shared/layout/bottom-nav";
import { QuickAddFab } from "@/shared/layout/quick-add-fab";
import { TopBar } from "@/shared/layout/top-bar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <TopBar />
      <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-4 md:pb-8">
        {children}
      </main>
      <QuickAddFab />
      <BottomNav />
    </div>
  );
}
