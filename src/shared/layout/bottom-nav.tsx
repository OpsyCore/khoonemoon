"use client";

import {
  CalendarDays,
  House,
  ListTodo,
  SunMedium,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { describeBadge, formatBadgeCount } from "@/shared/utils/badge-count";
import { cn } from "@/shared/utils/cn";

const navItems = [
  { href: "/home", label: "خانه", icon: House },
  { href: "/today", label: "امروز", icon: SunMedium },
  { href: "/calendar", label: "تقویم", icon: CalendarDays },
  { href: "/lists", label: "لیست‌ها", icon: ListTodo },
  { href: "/profile", label: "پروفایل", icon: UserRound },
] as const;

export function BottomNav({
  dueReminderCount = 0,
}: {
  dueReminderCount?: number;
}) {
  const pathname = usePathname();
  const badge = formatBadgeCount(dueReminderCount);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 backdrop-blur md:hidden">
      <ul className="mx-auto grid w-full max-w-md grid-cols-5 gap-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 px-1 py-2 text-[11px] font-medium transition",
                  isActive
                    ? "font-semibold text-olive-ink"
                    : "text-muted hover:text-ink",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <span
                  className={cn(
                    "relative inline-flex size-9 items-center justify-center rounded-full transition",
                    isActive &&
                      "-mt-4 size-11 bg-olive-deep text-cream shadow-paper-lg ring-4 ring-paper dark:text-[#221c14]",
                  )}
                >
                  <Icon className="size-5" />
                  {item.href === "/today" && badge ? (
                    <span
                      aria-hidden="true"
                      className="absolute -top-1.5 -left-2.5 flex min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-4 text-white"
                    >
                      {badge}
                    </span>
                  ) : null}
                </span>
                <span>{item.label}</span>
                {item.href === "/today" && badge ? (
                  <span className="sr-only">
                    {describeBadge(dueReminderCount)}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
