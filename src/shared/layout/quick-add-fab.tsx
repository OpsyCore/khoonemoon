"use client";

import {
  Plus,
  ShoppingCart,
  StickyNote,
  Wallet,
  CalendarPlus,
  CircleCheckBig,
  House,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/utils/cn";

type QuickAction =
  | {
      key: string;
      label: string;
      icon: typeof Plus;
      href: string;
      enabled: true;
    }
  | {
      key: string;
      label: string;
      icon: typeof Plus;
      enabled: false;
      soon?: boolean;
    };

const quickActions: QuickAction[] = [
  {
    key: "task",
    label: "تسک جدید",
    icon: CircleCheckBig,
    href: "/today#quick-add-task",
    enabled: true,
  },
  {
    key: "event",
    label: "رویداد جدید",
    icon: CalendarPlus,
    href: "/calendar#quick-add-event",
    enabled: true,
  },
  {
    key: "chore",
    label: "کار خانه",
    icon: House,
    href: "/home#chores",
    enabled: true,
  },
  {
    key: "shopping",
    label: "لیست خرید",
    icon: ShoppingCart,
    href: "/lists#quick-add-shopping",
    enabled: true,
  },
  {
    key: "bill",
    label: "هزینه / قبض",
    icon: Wallet,
    enabled: false,
    soon: true,
  },
  {
    key: "note",
    label: "یادداشت سریع",
    icon: StickyNote,
    enabled: false,
    soon: true,
  },
];

export function QuickAddFab() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  function handleAction(action: QuickAction) {
    if (!action.enabled) return;
    setIsOpen(false);
    router.push(action.href);
  }

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
              const disabled = !action.enabled;

              return (
                <li key={action.key}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => handleAction(action)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-right text-sm transition",
                      disabled
                        ? "cursor-not-allowed border-zinc-100 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500"
                        : "border-zinc-200 text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      {action.label}
                      {disabled && action.soon ? (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                          به‌زودی
                        </span>
                      ) : null}
                    </span>
                    <Icon className="size-4 shrink-0" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </>
  );
}
