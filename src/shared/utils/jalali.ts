const PERSIAN_JALALI_LOCALE = "fa-IR-u-ca-persian";

export function formatJalaliLongDate(date: Date) {
  return new Intl.DateTimeFormat(PERSIAN_JALALI_LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatJalaliMonthYear(date: Date) {
  return new Intl.DateTimeFormat(PERSIAN_JALALI_LOCALE, {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatJalaliDayNumber(date: Date) {
  return new Intl.DateTimeFormat(PERSIAN_JALALI_LOCALE, {
    day: "numeric",
  }).format(date);
}

const partsFormatter = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

export function getJalaliParts(date: Date) {
  const parts = partsFormatter.formatToParts(date);
  const number = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: number("year"), month: number("month"), day: number("day") };
}

function jalaliDayOrdinal(year: number, month: number, day: number) {
  return (month <= 6 ? (month - 1) * 31 : 186 + (month - 7) * 30) + (day - 1);
}

/**
 * Resolves a Jalali (year, month, day) to local noon using the runtime's exact
 * Persian calendar. 30 Esfand in a non-leap year resolves to 29 Esfand with
 * `leapAdjusted: true`.
 */
export function resolveJalaliDate(year: number, month: number, day: number) {
  const cappedDay = month <= 6 ? Math.min(day, 31) : Math.min(day, 30);
  const cursor = new Date(year + 621, 2, 21, 12, 0, 0, 0);
  cursor.setDate(cursor.getDate() + jalaliDayOrdinal(year, month, cappedDay));
  for (let step = 0; step < 8; step++) {
    const p = getJalaliParts(cursor);
    if (p.year === year && p.month === month && p.day === cappedDay) {
      return { date: cursor, leapAdjusted: false };
    }
    if (
      month === 12 &&
      cappedDay === 30 &&
      p.year === year + 1 &&
      p.month === 1 &&
      p.day === 1
    ) {
      const prev = new Date(cursor);
      prev.setDate(prev.getDate() - 1);
      const prevParts = getJalaliParts(prev);
      if (prevParts.year === year && prevParts.month === 12) {
        if (prevParts.day === 30) return { date: prev, leapAdjusted: false };
        if (prevParts.day === 29) return { date: prev, leapAdjusted: true };
      }
    }
    const approxCurrent =
      (p.year - year) * 365 + jalaliDayOrdinal(p.year, p.month, p.day);
    const targetOrd = jalaliDayOrdinal(year, month, cappedDay);
    const delta = targetOrd - approxCurrent;
    if (delta === 0) {
      cursor.setDate(cursor.getDate() + (p.year > year ? -1 : 1));
      continue;
    }
    cursor.setDate(cursor.getDate() + delta);
  }
  return { date: cursor, leapAdjusted: false };
}

/** Finds the next upcoming occurrence of a Jalali month/day on or after `from` (local day). */
export function nextJalaliOccurrence(
  month: number,
  day: number,
  from: Date = new Date(),
) {
  const todayStart = new Date(
    from.getFullYear(),
    from.getMonth(),
    from.getDate(),
  ).getTime();
  const currentYear = getJalaliParts(
    new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12),
  ).year;
  const thisYear = resolveJalaliDate(currentYear, month, day);
  const thisDayStart = new Date(
    thisYear.date.getFullYear(),
    thisYear.date.getMonth(),
    thisYear.date.getDate(),
  ).getTime();
  if (thisDayStart >= todayStart) {
    return { ...thisYear, jalaliYear: currentYear };
  }
  const nextYear = resolveJalaliDate(currentYear + 1, month, day);
  return { ...nextYear, jalaliYear: currentYear + 1 };
}

/** Iranian week [Saturday 00:00, next Saturday 00:00) in local time. */
export function getJalaliWeekRange(date: Date) {
  const start = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    0,
    0,
    0,
    0,
  );
  start.setDate(start.getDate() - ((start.getDay() + 1) % 7));
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end };
}

export function getPersianWeekdayLabels() {
  // Saturday is the first day of the Iranian week. Use local noon to avoid
  // day changes caused by UTC offsets and daylight-saving transitions.
  const saturday = new Date(2026, 0, 3, 12);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(saturday);
    day.setDate(saturday.getDate() + index);
    return new Intl.DateTimeFormat(PERSIAN_JALALI_LOCALE, {
      weekday: "short",
    }).format(day);
  });
}

export function getMonthGrid(date: Date) {
  const target = getJalaliParts(date);
  const firstDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    12,
  );
  firstDay.setDate(firstDay.getDate() - (target.day - 1));
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - ((firstDay.getDay() + 1) % 7));
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    const parts = getJalaliParts(day);
    return {
      date: day,
      isCurrentMonth:
        parts.month === target.month && parts.year === target.year,
    };
  });
}

/** Jump to the first day of the adjacent Persian month. */
export function shiftJalaliMonth(date: Date, direction: -1 | 1) {
  const first = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    12,
  );
  first.setDate(first.getDate() - (getJalaliParts(first).day - 1));
  if (direction === -1) first.setDate(first.getDate() - 1);
  else first.setDate(first.getDate() + 32);
  first.setDate(first.getDate() - (getJalaliParts(first).day - 1));
  return first;
}

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
