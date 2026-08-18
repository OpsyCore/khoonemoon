import type { InputHTMLAttributes } from "react";
import { cn } from "@/shared/utils/cn";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export function Input({
  className,
  label,
  hint,
  error,
  id,
  ...props
}: InputProps) {
  const fieldId = id ?? props.name;

  return (
    <div className="space-y-1.5">
      {label ? (
        <label
          htmlFor={fieldId}
          className="block text-sm font-medium text-zinc-800 dark:text-zinc-100"
        >
          {label}
        </label>
      ) : null}
      <input
        id={fieldId}
        className={cn(
          "h-11 w-full rounded-2xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100",
          error
            ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/30"
            : "",
          className,
        )}
        {...props}
      />
      {error ? (
        <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
      ) : null}
      {!error && hint ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>
      ) : null}
    </div>
  );
}
