import { useId, type InputHTMLAttributes, type Ref } from "react";
import { cn } from "@/shared/utils/cn";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
  // React 19 forwards `ref` as a normal prop for function components.
  ref?: Ref<HTMLInputElement>;
};

export function Input({
  className,
  label,
  hint,
  error,
  id,
  ref,
  ...props
}: InputProps) {
  const generatedId = useId();
  const fieldId = id ?? props.name ?? generatedId;

  return (
    <div className="space-y-1.5">
      {label ? (
        <label
          htmlFor={fieldId}
          className="block text-sm font-medium text-[var(--app-ink)]"
        >
          {label}
        </label>
      ) : null}
      <input
        ref={ref}
        id={fieldId}
        className={cn(
          "h-11 w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-raised)] px-3 text-sm text-[var(--app-ink)] outline-none transition placeholder:text-[var(--app-muted)] focus:border-[var(--app-primary)] focus:ring-2 focus:ring-[var(--app-focus)]",
          error ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/30" : "",
          className,
        )}
        {...props}
      />
      {error ? (
        <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
      ) : null}
      {!error && hint ? (
        <p className="text-xs text-[var(--app-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}
