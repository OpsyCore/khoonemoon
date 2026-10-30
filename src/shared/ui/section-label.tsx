import type { ReactNode } from "react";
import { cn } from "@/shared/utils/cn";

/**
 * Reference section heading — quiet bold Persian label at the reading
 * start, with an optional small action (e.g. «مشاهده همه») at the far
 * side, exactly like the reference's section rows.
 */
export function SectionLabel({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <h2 className="min-w-0 text-[14.5px] font-bold text-ink">{children}</h2>
      {action ? (
        <div className="shrink-0 text-[12px] font-medium text-olive-ink">
          {action}
        </div>
      ) : null}
    </div>
  );
}
