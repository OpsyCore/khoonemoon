"use client";

import { cn } from "@/shared/utils/cn";

/**
 * Warm paper switch — olive when on, kraft when off.
 */
export function Toggle({
  checked,
  onChange,
  label,
  description,
  id,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  id?: string;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center justify-between gap-4 py-3"
    >
      <span className="min-w-0">
        <span className="block text-sm text-ink">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-[11px] text-muted">
            {description}
          </span>
        ) : null}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full border transition",
          checked ? "border-olive bg-olive" : "border-line-strong bg-sunken",
        )}
      >
        <span
          className={cn(
            "absolute top-1/2 size-4.5 -translate-y-1/2 rounded-full bg-card shadow-paper transition-all",
            checked ? "left-0.5" : "left-[calc(100%-1.25rem)]",
          )}
        />
      </button>
    </label>
  );
}
