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
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95 md:hidden">
      <ul className="mx-auto grid w-full max-w-md grid-cols-5 gap-1">
        {navItems.map((item) => {
          const isActive = isBottomNavActive(pathname, item.href);
          const Icon = item.icon;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[11px] font-medium transition",
                  isActive
                    ? "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="size-4" />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
