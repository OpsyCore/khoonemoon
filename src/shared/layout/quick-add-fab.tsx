"use client";

import {
  Plus,
  ShoppingCart,
  StickyNote,
  Wallet,
  CalendarPlus,
  CircleCheckBig,
  House,
  X,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
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
    href: "/finance#quick-add-finance",
    enabled: true,
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
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  function handleAction(action: QuickAction) {
    if (!action.enabled) return;
    setIsOpen(false);

    const hashIndex = action.href.indexOf("#");
    if (hashIndex >= 0) {
      const path = action.href.slice(0, hashIndex) || pathname;
      const hash = action.href.slice(hashIndex);
      if (pathname === path) {
        window.dispatchEvent(
          new CustomEvent("khoonemoon:quick-add", { detail: hash }),
        );
        return;
      }
    }

    router.push(action.href);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] left-4 z-40 inline-flex size-12 items-center justify-center rounded-full bg-olive text-cream shadow-paper-lg transition hover:bg-olive-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive focus-visible:ring-offset-2 focus-visible:ring-offset-paper dark:text-[#221c14] md:left-6"
        aria-label="افزودن سریع"
      >
        <Plus className="size-5" strokeWidth={2} />
      </button>

      <div
        className={cn(
          "fixed inset-0 z-50 bg-ink/40 transition",
          isOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
        onClick={() => setIsOpen(false)}
      >
        <section
          className={cn(
            "absolute inset-x-0 bottom-0 rounded-t-[24px] border-t border-line bg-paper p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] shadow-paper-lg transition-transform md:inset-x-auto md:bottom-6 md:left-6 md:w-96 md:rounded-card md:border",
            isOpen ? "translate-y-0" : "translate-y-full md:translate-y-4",
          )}
          onClick={(event) => event.stopPropagation()}
        >
          <span className="mx-auto mb-4 block h-1 w-10 rounded-full bg-kraft md:hidden" />

          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-ink">افزودن سریع</h2>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="inline-flex size-8 items-center justify-center rounded-full text-muted transition hover:bg-sunken hover:text-ink"
              aria-label="بستن"
            >
              <X className="size-4" strokeWidth={1.75} />
            </button>
          </div>

          <ul className="grid grid-cols-2 gap-2.5">
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
                      "flex w-full flex-col items-start gap-2.5 rounded-card border p-3.5 text-right text-[13px] font-medium transition",
                      disabled
                        ? "cursor-not-allowed border-line/70 text-faint"
                        : "border-line bg-card text-ink shadow-paper hover:border-olive/60 hover:bg-olive-soft/50",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex size-9 items-center justify-center rounded-full",
                        disabled
                          ? "bg-sunken text-faint"
                          : "bg-olive-soft text-olive-ink",
                      )}
                    >
                      <Icon className="size-[18px]" strokeWidth={1.75} />
                    </span>
                    <span className="flex items-center gap-1.5">
                      {action.label}
                      {disabled && action.soon ? (
                        <span className="rounded-full bg-sunken px-2 py-0.5 text-[10px] font-normal text-muted">
                          به‌زودی
                        </span>
                      ) : null}
                    </span>
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
