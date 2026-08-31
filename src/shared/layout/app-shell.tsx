import type { ReactNode } from "react";
import { BottomNav } from "@/shared/layout/bottom-nav";
import { QuickAddFab } from "@/shared/layout/quick-add-fab";
import { TopBar } from "@/shared/layout/top-bar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <TopBar />
      <main className="mx-auto w-full max-w-3xl px-4 pb-32 pt-6 md:px-6">
        {children}
      </main>
      <QuickAddFab />
      <BottomNav />
    </div>
  );
}
