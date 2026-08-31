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

const navItems = [
  { href: "/today", label: "امروز", icon: SunMedium },
  { href: "/calendar", label: "تقویم", icon: CalendarDays },
  { href: "/home", label: "خونه", icon: House },
  { href: "/lists", label: "لیست‌ها", icon: ListTodo },
  { href: "/profile", label: "پروفایل", icon: UserRound },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto grid w-full max-w-md grid-cols-5 px-2 py-1.5">
        {navItems.map((item) => {
          const isActive = isBottomNavActive(pathname, item.href);
          const Icon = item.icon;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "group flex flex-col items-center gap-0.5 rounded-2xl px-1 py-1.5 text-[10.5px] font-medium transition",
                  isActive ? "text-olive-ink" : "text-muted hover:text-ink",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <span
                  className={cn(
                    "inline-flex h-7 w-12 items-center justify-center rounded-full transition",
                    isActive ? "bg-olive-soft" : "group-hover:bg-sunken",
                  )}
                >
                  <Icon
                    className="size-[18px]"
                    strokeWidth={isActive ? 2 : 1.75}
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
