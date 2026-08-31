import type { ReactNode } from "react";
import { cn } from "@/shared/utils/cn";

/**
 * Small editorial section label with a hairline rule — the quiet way
 * sections are introduced across the journal.
 */
export function SectionLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="inline-block size-1.5 rounded-full bg-olive" />
      <h2 className="shrink-0 text-[13px] font-semibold tracking-wide text-ink-soft">
        {children}
      </h2>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
