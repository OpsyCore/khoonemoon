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
  // A generated id keeps <label htmlFor> working even when callers pass
  // neither `id` nor `name` (previously the label pointed at nothing).
  const generatedId = useId();
  const fieldId = id ?? props.name ?? generatedId;

  return (
    <div className="space-y-1.5">
      {label ? (
        <label
          htmlFor={fieldId}
          className="block text-[13px] font-medium text-ink-soft"
        >
          {label}
        </label>
      ) : null}
      <input
        ref={ref}
        id={fieldId}
        className={cn(
          "h-11 w-full rounded-field border border-line-strong bg-paper px-3.5 text-sm text-ink outline-none transition placeholder:text-faint focus:border-olive focus:ring-2 focus:ring-olive/25",
          error ? "border-danger focus:border-danger focus:ring-danger/25" : "",
          className,
        )}
        {...props}
      />
      {error ? <p className="text-xs text-danger-ink">{error}</p> : null}
      {!error && hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
