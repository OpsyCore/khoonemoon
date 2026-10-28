const PERSIAN_LOCALE = "fa-IR";

export function toPersianNumber(value: number | string) {
  return new Intl.NumberFormat(PERSIAN_LOCALE).format(Number(value));
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatPersianDate(value: Date | string) {
  return new Intl.DateTimeFormat(PERSIAN_LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(toDate(value));
}

export function formatPersianShortDate(value: Date | string) {
  return new Intl.DateTimeFormat(PERSIAN_LOCALE, {
    day: "numeric",
    month: "long",
  }).format(toDate(value));
}

export function formatPersianTime(value: Date | string) {
  return new Intl.DateTimeFormat(PERSIAN_LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(toDate(value));
}
