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

export function getPersianWeekdayLabels() {
  const start = new Date("2026-01-04T00:00:00.000Z");
  return Array.from({ length: 7 }).map((_, index) => {
    const d = new Date(start);
    d.setDate(start.getDate() + index);

    return new Intl.DateTimeFormat(PERSIAN_JALALI_LOCALE, {
      weekday: "short",
    }).format(d);
  });
}

export function getMonthGrid(date: Date) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const month = firstDay.getMonth();

  const startWeekday = firstDay.getDay();
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - startWeekday);

  const days: Date[] = [];

  for (let i = 0; i < 42; i += 1) {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + i);
    days.push(day);
  }

  return days.map((d) => ({
    date: d,
    isCurrentMonth: d.getMonth() === month,
  }));
}

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
