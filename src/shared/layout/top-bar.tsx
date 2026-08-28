import { FileText, Search, Settings } from "lucide-react";
import Link from "next/link";
import { LogoutButton } from "@/features/auth/components/logout-button";
import { ConnectionStatus } from "@/shared/layout/connection-status";
import { ThemeToggle } from "@/shared/layout/theme-toggle";
import { formatPersianDate } from "@/shared/utils/locale";

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {formatPersianDate(new Date())}
          </p>
          <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            خونه‌مون
          </h1>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href="/documents"
            className="inline-flex h-9 w-9 items-center justify-center rounded-2xl text-zinc-700 transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-zinc-100 dark:hover:bg-zinc-800"
            aria-label="مدارک"
          >
            <FileText className="size-4" />
          </Link>
          <Link
            href="/search"
            className="inline-flex h-9 w-9 items-center justify-center rounded-2xl text-zinc-700 transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-zinc-100 dark:hover:bg-zinc-800"
            aria-label="جستجو"
          >
            <Search className="size-4" />
          </Link>
          <Link
            href="/settings"
            className="inline-flex h-9 w-9 items-center justify-center rounded-2xl text-zinc-700 transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-zinc-100 dark:hover:bg-zinc-800"
            aria-label="تنظیمات"
          >
            <Settings className="size-4" />
          </Link>
          <ConnectionStatus />
          <ThemeToggle />
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
