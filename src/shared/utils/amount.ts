const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/**
 * Parses a money field typed by a Persian-speaking user.
 *
 * Accepts Persian (`۴۵۰٬۰۰۰`) and Arabic (`١٢٠٠`) digits plus the usual
 * separators, and rejects anything that is not a non-negative number. Returns
 * `null` rather than `NaN` so callers must decide what to do with a bad value.
 */
export function parseAmount(input: string): number | null {
  const normalized = input
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)))
    .replace(/[,٬\s]/g, "");

  if (!normalized) return null;

  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;

  return value;
}

/** Groups a number the way Persian users read money: `۱٬۲۵۰٬۰۰۰`. */
export function formatGroupedAmount(value: number): string {
  if (!Number.isFinite(value)) return "—";

  return new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 }).format(
    Math.round(value),
  );
}
