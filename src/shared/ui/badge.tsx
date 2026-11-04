import type { HTMLAttributes } from "react";
import { cn } from "@/shared/utils/cn";

type BadgeTone = "neutral" | "success" | "warning" | "danger";

const tones: Record<BadgeTone, string> = {
  neutral:
    "border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-ink)]",
  success:
    "border border-olive/30 bg-olive/15 text-[var(--app-ink)]",
  warning:
    "border border-terracotta/30 bg-terracotta/15 text-[var(--app-ink)]",
  danger:
    "border border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200",
};

export function Badge({
  className,
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
