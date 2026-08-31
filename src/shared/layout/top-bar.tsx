import { FileText, Search, Settings } from "lucide-react";
import Link from "next/link";
import { LogoutButton } from "@/features/auth/components/logout-button";
import { ConnectionStatus } from "@/shared/layout/connection-status";
import { ThemeToggle } from "@/shared/layout/theme-toggle";
import { formatJalaliLongDate } from "@/shared/utils/jalali";

const topLinks = [
  { href: "/documents", label: "مدارک", icon: FileText },
  { href: "/search", label: "جستجو", icon: Search },
  { href: "/settings", label: "تنظیمات", icon: Settings },
] as const;

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-paper/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3 md:px-6">
        <div className="min-w-0">
          <p className="truncate text-lg font-bold leading-6 text-ink">
            خونه‌مون
          </p>
          <p className="truncate text-[11px] text-muted">
            {formatJalaliLongDate(new Date())}
          </p>
        </div>

        <div className="flex items-center gap-0.5">
          <ConnectionStatus />
          {topLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="inline-flex size-9 items-center justify-center rounded-full text-ink-soft transition hover:bg-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive"
              aria-label={label}
            >
              <Icon className="size-[18px]" strokeWidth={1.75} />
            </Link>
          ))}
          <ThemeToggle />
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
