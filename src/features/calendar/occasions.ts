import {
  getJalaliParts,
  nextJalaliOccurrence,
  resolveJalaliDate,
} from "@/shared/utils/jalali";
import { eventOverlaps } from "./event-days";
import type { EventRecord, OccasionType, ProjectedEventRecord } from "./types";

export const OCCASION_LABELS: Record<OccasionType, string> = {
  BIRTHDAY: "تولد",
  ANNIVERSARY: "سالگرد",
  PERSONAL: "مناسبت شخصی",
};

/**
 * Projects annual Jalali occasions into [from, to) without duplicating stored
 * database rows. 30 Esfand in non-leap years resolves to 29 Esfand (`leapAdjusted`).
 */
export function projectCalendarEvents(
  events: EventRecord[],
  from: Date,
  to: Date,
): ProjectedEventRecord[] {
  const fromYear = getJalaliParts(
    new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12),
  ).year;
  const toYear = getJalaliParts(
    new Date(to.getFullYear(), to.getMonth(), to.getDate(), 12),
  ).year;
  const out: ProjectedEventRecord[] = [];

  for (const ev of events) {
    if (
      ev.recurrence_calendar !== "JALALI_YEARLY" ||
      !ev.jalali_month ||
      !ev.jalali_day
    ) {
      if (eventOverlaps(ev.start_at, ev.end_at, from, to)) out.push(ev);
      continue;
    }
    const baseStart = new Date(ev.start_at);
    const baseEnd = new Date(ev.end_at);
    const durationMs = Math.max(
      60_000,
      baseEnd.getTime() - baseStart.getTime(),
    );
    const baseYear = Number.isFinite(baseStart.getTime())
      ? getJalaliParts(
          new Date(
            baseStart.getFullYear(),
            baseStart.getMonth(),
            baseStart.getDate(),
            12,
          ),
        ).year
      : fromYear;

    for (let jy = fromYear - 1; jy <= toYear + 1; jy++) {
      if (jy < baseYear) continue;
      const resolved = resolveJalaliDate(jy, ev.jalali_month, ev.jalali_day);
      const occStart = new Date(
        resolved.date.getFullYear(),
        resolved.date.getMonth(),
        resolved.date.getDate(),
        ev.all_day ? 0 : baseStart.getHours(),
        ev.all_day ? 0 : baseStart.getMinutes(),
        0,
        0,
      );
      const occEnd = ev.all_day
        ? new Date(
            resolved.date.getFullYear(),
            resolved.date.getMonth(),
            resolved.date.getDate() + 1,
            0,
            0,
            0,
            0,
          )
        : new Date(occStart.getTime() + durationMs);
      const sIso = occStart.toISOString();
      const eIso = occEnd.toISOString();
      if (eventOverlaps(sIso, eIso, from, to)) {
        out.push({
          ...ev,
          start_at: sIso,
          end_at: eIso,
          occurrenceYear: jy,
          yearsElapsed: jy > baseYear ? jy - baseYear : undefined,
          leapAdjusted: resolved.leapAdjusted,
        });
      }
    }
  }

  return out.sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
  );
}

/** Computes the next reminder base timestamp (9:00 local for all-day occasions). */
export function nextOccasionBaseAt(
  month: number,
  day: number,
  hour = 9,
  minute = 0,
  now: Date = new Date(),
) {
  const occ = nextJalaliOccurrence(month, day, now);
  const candidate = new Date(
    occ.date.getFullYear(),
    occ.date.getMonth(),
    occ.date.getDate(),
    hour,
    minute,
    0,
    0,
  );
  if (candidate.getTime() <= now.getTime()) {
    const nextYear = resolveJalaliDate(occ.jalaliYear + 1, month, day);
    return {
      iso: new Date(
        nextYear.date.getFullYear(),
        nextYear.date.getMonth(),
        nextYear.date.getDate(),
        hour,
        minute,
        0,
        0,
      ).toISOString(),
      jalaliYear: occ.jalaliYear + 1,
      leapAdjusted: nextYear.leapAdjusted,
    };
  }
  return {
    iso: candidate.toISOString(),
    jalaliYear: occ.jalaliYear,
    leapAdjusted: occ.leapAdjusted,
  };
}
