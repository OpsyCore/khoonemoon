"use client";

import { useTheme } from "next-themes";
import { THEME_OPTIONS } from "@/features/settings/theme-options";
import { Card, CardDescription, CardTitle } from "@/shared/ui/card";
import { cn } from "@/shared/utils/cn";

export function AppearanceSettingsCard() {
  const { theme, setTheme } = useTheme();

  return (
    <Card className="space-y-3 p-5">
      <div>
        <CardTitle>ظاهر</CardTitle>
        <CardDescription>
          روشن مثل کاغذ روز، تاریک مثل همان دفترچه در شب.
        </CardDescription>
      </div>
      <div className="flex w-full rounded-full bg-sunken p-1 sm:w-fit">
        {THEME_OPTIONS.map((option) => {
          const selected = (theme ?? "system") === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setTheme(option.id)}
              aria-pressed={selected}
              className={cn(
                "flex-1 rounded-full px-4 py-1.5 text-[12px] font-medium transition sm:flex-none",
                selected
                  ? "bg-card text-ink shadow-paper"
                  : "text-muted hover:text-ink",
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
