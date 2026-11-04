import type { ReactNode } from "react";
import { BranchDecor } from "@/shared/ui/decor";
import { cn } from "@/shared/utils/cn";

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-card border border-dashed border-line-strong bg-card/60 px-6 py-10 text-center",
        className,
      )}
    >
      <BranchDecor className="mb-1 opacity-80" />
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      <p className="max-w-xs text-[13px] leading-6 text-muted">{description}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
