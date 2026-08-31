import type { ReactNode } from "react";
import { cn } from "@/shared/utils/cn";

/**
 * Editorial page header — large calm title, small muted subtitle.
 * The single voice for every screen's opening.
 */
export function PageHeader({
  title,
  subtitle,
  kicker,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  kicker?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex items-end justify-between gap-4", className)}>
      <div className="min-w-0 space-y-1.5">
        {kicker ? (
          <p className="text-[11px] font-medium tracking-wide text-clay-ink">
            {kicker}
          </p>
        ) : null}
        <h1 className="text-[28px] font-bold leading-[1.25] text-ink md:text-[32px]">
          {title}
        </h1>
        {subtitle ? (
          <p className="text-[13px] leading-6 text-muted">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0 pb-1">{action}</div> : null}
    </header>
  );
}
