"use client";

import {
  Plus,
  ShoppingCart,
  StickyNote,
  Wallet,
  CalendarPlus,
  CircleCheckBig,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/utils/cn";

const quickActions = [
  { key: "task", label: "تسک جدید", icon: CircleCheckBig },
  { key: "event", label: "رویداد جدید", icon: CalendarPlus },
  { key: "shopping", label: "آیتم خرید", icon: ShoppingCart },
  { key: "bill", label: "هزینه / قبض", icon: Wallet },
  { key: "note", label: "یادداشت سریع", icon: StickyNote },
] as const;

export function QuickAddFab() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 left-4 z-40 inline-flex size-14 items-center justify-center rounded-full bg-sky-600 text-white shadow-lg shadow-sky-600/30 transition hover:bg-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:ring-offset-zinc-950 md:bottom-6 md:right-6 md:left-auto"
        aria-label="افزودن سریع"
      >
        <Plus className="size-6" />
      </button>

      <div
        className={cn(
          "fixed inset-0 z-50 bg-zinc-900/40 transition",
          isOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
        onClick={() => setIsOpen(false)}
      >
        <section
          className={cn(
            "absolute inset-x-0 bottom-0 rounded-t-3xl border border-zinc-200 bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl transition-transform dark:border-zinc-800 dark:bg-zinc-900 md:inset-x-auto md:bottom-6 md:left-auto md:right-6 md:w-80 md:rounded-3xl",
            isOpen ? "translate-y-0" : "translate-y-full md:translate-y-4",
          )}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              افزودن سریع
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
              بستن
            </Button>
          </div>

          <ul className="space-y-2">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <li key={action.key}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-2xl border border-zinc-200 px-3 py-3 text-right text-sm text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <span>{action.label}</span>
                    <Icon className="size-4" />
                  </button>
                </li>
              );
            })}
          </ul>

          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            این بخش فعلاً پوسته رابط کاربری است و به منطق ثبت داده متصل نشده.
          </p>
        </section>
      </div>
    </>
  );
}
