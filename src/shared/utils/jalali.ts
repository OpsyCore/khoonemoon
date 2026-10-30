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

function persianParts(date: Date) {
  const parts = partsFormatter.formatToParts(date);
  const number = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: number("year"), month: number("month"), day: number("day") };
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
  const target = persianParts(date);
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
    const parts = persianParts(day);
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
  first.setDate(first.getDate() - (persianParts(first).day - 1));
  if (direction === -1) first.setDate(first.getDate() - 1);
  else first.setDate(first.getDate() + 32);
  first.setDate(first.getDate() - (persianParts(first).day - 1));
  return first;
}

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
