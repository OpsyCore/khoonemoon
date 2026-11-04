import { cn } from "@/shared/utils/cn";

/**
 * Restrained botanical / paper decorations for the Khoonemoon journal look.
 * Use sparingly: empty states, auth screens, occasional page headers.
 */

export function BranchDecor({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 64"
      fill="none"
      aria-hidden="true"
      className={cn("h-12 w-24 text-olive", className)}
    >
      <path
        d="M6 58C34 46 72 30 114 8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M34 46c-2-9 2-15 9-18 1 8-2 14-9 18Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M56 36c-1-9 4-15 11-17 0 8-4 14-11 17Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M78 26c0-9 5-14 12-16-1 8-5 13-12 16Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M40 50c8 1 13 5 15 11-8 0-13-4-15-11Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="97" cy="14" r="2.4" fill="#E07A5F" opacity="0.85" />
    </svg>
  );
}

export function SproutDecor({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className={cn("size-10 text-olive", className)}
    >
      <path
        d="M24 42V22"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M24 24c-9 0-14-5-15-13 9 0 14 5 15 13Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M24 30c7 0 11-4 12-10-7 0-11 4-12 10Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A small piece of masking tape — occasional scrapbook accent. */
export function TapeStrip({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none block h-6 w-24 -rotate-2 rounded-[3px] border border-kraft/60 bg-kraft/45 shadow-paper backdrop-blur-[1px]",
        className,
      )}
    />
  );
}
