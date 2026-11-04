import type { ReactNode } from "react";
import { BranchDecor } from "@/shared/ui/decor";
import { cn } from "@/shared/utils/cn";

/**
 * Reference page header — the shared opening composition of every screen:
 * large Persian title at the reading start (right in RTL), a small muted
 * subtitle beneath it, an optional circular icon action on the far side,
 * an optional botanical branch behind the title area, and a thin paper
 * divider closing the header.
 */
export function PageHeader({
  title,
  subtitle,
  kicker,
  action,
  decor = false,
  divider = true,
  className,
}: {
  title: string;
  subtitle?: string;
  kicker?: string;
  action?: ReactNode;
  /** Show the subtle botanical branch near the title, as in the reference. */
  decor?: boolean;
  /** Thin divider under the header (on by default, per the reference). */
  divider?: boolean;
  className?: string;
}) {
  return (
    <header className={cn("relative", className)}>
      {decor ? (
        <BranchDecor className="pointer-events-none absolute -top-2 left-8 h-11 w-20 -scale-x-100 opacity-25" />
      ) : null}
      <div className="flex items-start justify-between gap-4">
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
        {action ? <div className="shrink-0 pt-1">{action}</div> : null}
      </div>
      {divider ? <div className="mt-4 border-b border-line" /> : null}
    </header>
  );
}

/**
 * Circular paper icon button used beside page titles (bell, settings,
 * edit…), matching the reference's header icon chips.
 */
export function HeaderIconLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      aria-label={label}
      title={label}
      className="inline-flex size-10 items-center justify-center rounded-full border border-line-strong bg-card text-ink-soft shadow-paper transition hover:bg-sunken hover:text-ink"
    >
      {children}
    </a>
  );
}
