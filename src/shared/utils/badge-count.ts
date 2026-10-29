/**
 * Badge counts on the navigation bar.
 *
 * Reminders that are due can pile up; showing "12" on a 5-item nav bar is noise,
 * so anything above the cap becomes "۹+". The formatter is deliberately separate
 * from the component so the rule is testable and identical everywhere.
 */

export const BADGE_CAP = 9;

/** Returns `null` when nothing should be shown. */
export function formatBadgeCount(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) return null;

  const safe = Math.floor(count);

  if (safe > BADGE_CAP) return `${toPersianDigits(BADGE_CAP)}+`;

  return toPersianDigits(safe);
}

export function toPersianDigits(value: number): string {
  return new Intl.NumberFormat("fa-IR", { useGrouping: false }).format(value);
}

/** Screen-reader text: "۳ یادآور رسیده" — a bare "۳" says nothing. */
export function describeBadge(count: number, noun = "یادآور رسیده"): string {
  if (count <= 0) return "";

  return `${toPersianDigits(Math.floor(count))} ${noun}`;
}
