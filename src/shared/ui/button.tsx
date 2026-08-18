import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/shared/utils/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-sky-600 text-white hover:bg-sky-500 focus-visible:ring-sky-500 disabled:bg-sky-400 dark:bg-sky-500 dark:hover:bg-sky-400",
  secondary:
    "bg-zinc-900 text-white hover:bg-zinc-700 focus-visible:ring-zinc-500 disabled:bg-zinc-500 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200",
  ghost:
    "bg-transparent text-zinc-700 hover:bg-zinc-100 focus-visible:ring-zinc-400 dark:text-zinc-100 dark:hover:bg-zinc-800",
  danger:
    "bg-rose-600 text-white hover:bg-rose-500 focus-visible:ring-rose-500 disabled:bg-rose-400",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-5 text-base",
};

export function Button({
  className,
  children,
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed dark:focus-visible:ring-offset-zinc-950",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? "در حال انجام..." : children}
    </button>
  );
}
