import { LogoutButton } from "@/features/auth/components/logout-button";
import { ConnectionStatus } from "@/shared/layout/connection-status";
import { ThemeToggle } from "@/shared/layout/theme-toggle";
import { formatPersianDate } from "@/shared/utils/locale";

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-card/90 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted">{formatPersianDate(new Date())}</p>
          <h1 className="text-base font-semibold text-ink">خونه‌مون</h1>
        </div>
        <div className="flex items-center gap-1">
          <ConnectionStatus />
          <ThemeToggle />
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
