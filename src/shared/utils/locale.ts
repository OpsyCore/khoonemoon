const PERSIAN_LOCALE = "fa-IR";

export function toPersianNumber(value: number | string) {
  return new Intl.NumberFormat(PERSIAN_LOCALE).format(Number(value));
}

export function formatPersianDate(date: Date) {
  return new Intl.DateTimeFormat(PERSIAN_LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatPersianTime(date: Date) {
  return new Intl.DateTimeFormat(PERSIAN_LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
