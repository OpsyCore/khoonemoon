"use client";

import { useTheme } from "next-themes";
import { THEME_OPTIONS } from "@/features/settings/theme-options";
import { Card, CardDescription, CardTitle } from "@/shared/ui/card";
import { cn } from "@/shared/utils/cn";

export function AppearanceSettingsCard() {
  const { theme, setTheme } = useTheme();

  return (
    <Card className="space-y-3">
      <CardTitle>ظاهر</CardTitle>
      <CardDescription>
        پوسته از تنظیمات همین دستگاه خوانده می‌شود و با نوار بالا مشترک است.
      </CardDescription>
      <div className="flex flex-wrap gap-2">
        {THEME_OPTIONS.map((option) => {
          const selected = (theme ?? "system") === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setTheme(option.id)}
              aria-pressed={selected}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                selected
                  ? "border-sky-300 bg-sky-100 text-sky-800 dark:border-sky-800 dark:bg-sky-900/40 dark:text-sky-200"
                  : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
