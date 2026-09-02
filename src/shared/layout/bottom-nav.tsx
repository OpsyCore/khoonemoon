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
import { isBottomNavActive } from "@/shared/layout/nav-active";
import { cn } from "@/shared/utils/cn";

/**
 * Reference bottom navigation — five fixed destinations, RTL order.
 * Active item: raised deep-olive filled circle with the icon, label below.
 * Inactive: thin line icon + muted label on the paper bar.
 */
const navItems = [
  { href: "/home", label: "خانه", icon: House },
  { href: "/today", label: "امروز", icon: SunMedium },
  { href: "/calendar", label: "تقویم", icon: CalendarDays },
  { href: "/lists", label: "لیست‌ها", icon: ListTodo },
  { href: "/profile", label: "پروفایل", icon: UserRound },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto grid w-full max-w-md grid-cols-5 px-3 pb-1.5 pt-2">
        {navItems.map((item) => {
          const isActive = isBottomNavActive(pathname, item.href);
          const Icon = item.icon;

          return (
            <li key={item.href} className="flex justify-center">
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group flex flex-col items-center gap-1 text-[10.5px] font-medium transition",
                  isActive
                    ? "font-semibold text-olive-ink"
                    : "text-muted hover:text-ink",
                )}
              >
                <span
                  className={cn(
                    "inline-flex items-center justify-center rounded-full transition-all",
                    isActive
                      ? "-mt-5 size-11 bg-olive-deep text-cream shadow-paper-lg ring-4 ring-paper dark:text-[#221c14]"
                      : "h-7 w-11 group-hover:bg-sunken",
                  )}
                >
                  <Icon
                    className={cn(isActive ? "size-5" : "size-[19px]")}
                    strokeWidth={isActive ? 2 : 1.6}
                  />
                </span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
