"use client";

import { Home, Receipt, ShoppingBasket } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ChoreBoard } from "@/features/chores/components/chore-board";
import type { ChoreCompletion, ChoreRecord } from "@/features/chores/types";
import { FinanceBoard } from "@/features/finance/components/finance-board";
import { FinanceCharts } from "@/features/finance/components/finance-charts";
import { SettlementCard } from "@/features/finance/components/settlement-card";
import type { FinancialRecord } from "@/features/finance/types";
import { ShoppingBoard } from "@/features/shopping/components/shopping-board";
import type { ShoppingItem, ShoppingList } from "@/features/shopping/types";
import type { TaskMember } from "@/features/tasks/types";
import { cn } from "@/shared/utils/cn";

type TabKey = "shopping" | "chores" | "finance";

const TABS: { key: TabKey; label: string; icon: typeof ShoppingBasket }[] = [
  { key: "shopping", label: "خرید", icon: ShoppingBasket },
  { key: "chores", label: "کارهای خانه", icon: Home },
  { key: "finance", label: "مالی", icon: Receipt },
];

export function ListsTabs({
  lists,
  items,
  chores,
  completions,
  records,
  members,
  activeListId,
  canShare,
  currentUserId,
}: {
  lists: ShoppingList[];
  items: ShoppingItem[];
  chores: ChoreRecord[];
  completions: ChoreCompletion[];
  records: FinancialRecord[];
  members: TaskMember[];
  activeListId: string | null;
  canShare: boolean;
  currentUserId: string;
}) {
  const [tab, setTab] = useState<TabKey>("shopping");

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="بخش‌های لیست‌ها"
        className="grid grid-cols-3 gap-1 rounded-2xl bg-zinc-100 p-1 dark:bg-zinc-900"
      >
        {TABS.map((item) => {
          const Icon = item.icon;
          const isActive = tab === item.key;

          return (
            <button
              key={item.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => setTab(item.key)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-medium transition",
                isActive
                  ? "bg-white text-sky-700 shadow-sm dark:bg-zinc-800 dark:text-sky-300"
                  : "text-zinc-600 dark:text-zinc-300",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === "shopping" ? (
        <ShoppingBoard
          lists={lists}
          initialItems={items}
          initialListId={activeListId}
        />
      ) : null}

      {tab === "chores" ? (
        <ChoreBoard
          chores={chores}
          completions={completions}
          members={members}
          canManage={canShare}
        />
      ) : null}

      {tab === "finance" ? (
        <div className="space-y-4">
          <SettlementCard
            records={records}
            members={members.map((member) => ({
              id: member.user_id,
              name: member.full_name,
            }))}
            currentUserId={currentUserId}
          />
          <Link
            href="/finance"
            className="block rounded-2xl border border-zinc-200 bg-white p-3 text-center text-sm font-medium text-sky-700 shadow-sm transition hover:bg-sky-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-sky-300 dark:hover:bg-sky-950/30"
          >
            دفتر تراکنش‌ها — همهٔ رکوردها با فیلتر
          </Link>
          <FinanceCharts records={records} now={new Date()} />
          <FinanceBoard records={records} canShare={canShare} />
        </div>
      ) : null}
    </div>
  );
}
