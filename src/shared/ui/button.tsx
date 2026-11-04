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
    "bg-[var(--app-primary)] text-white hover:brightness-95 focus-visible:ring-[var(--app-primary)] disabled:opacity-55",
  secondary:
    "bg-[var(--app-surface)] text-[var(--app-ink)] border border-[var(--app-border)] hover:bg-[var(--app-border)] focus-visible:ring-[var(--app-primary)] disabled:opacity-55",
  ghost:
    "bg-transparent text-[var(--app-ink)] hover:bg-[var(--app-surface)] focus-visible:ring-[var(--app-primary)] disabled:opacity-55",
  danger:
    "bg-rose-700 text-white hover:bg-rose-600 focus-visible:ring-rose-500 disabled:opacity-55",
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
        "inline-flex items-center justify-center gap-2 rounded-2xl font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-bg)] disabled:cursor-not-allowed",
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
