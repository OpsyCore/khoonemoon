import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/shared/utils/cn";

type ButtonVariant =
  "primary" | "secondary" | "soft" | "ghost" | "danger" | "clay";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-olive text-cream shadow-paper hover:bg-olive-deep focus-visible:ring-olive disabled:opacity-60 dark:text-[#221c14]",
  secondary:
    "border border-line-strong bg-card text-ink hover:bg-sunken focus-visible:ring-olive disabled:opacity-60",
  soft: "bg-olive-soft text-olive-ink hover:bg-olive/25 focus-visible:ring-olive disabled:opacity-60",
  ghost:
    "bg-transparent text-ink-soft hover:bg-sunken focus-visible:ring-olive disabled:opacity-60",
  danger:
    "bg-danger text-cream hover:opacity-90 focus-visible:ring-danger disabled:opacity-60",
  clay: "bg-clay text-cream hover:opacity-90 focus-visible:ring-clay disabled:opacity-60",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-[13px]",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base",
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
        "inline-flex items-center justify-center gap-2 rounded-full font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:cursor-not-allowed",
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
