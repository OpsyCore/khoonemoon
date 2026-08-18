import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/utils/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
      {children}
    </h3>
  );
}

export function CardDescription({ children }: { children: ReactNode }) {
  return (
    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{children}</p>
  );
}
