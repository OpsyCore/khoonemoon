import { describe, expect, it } from "vitest";
import {
  formatJalaliDayNumber,
  formatJalaliLongDate,
  formatJalaliMonthYear,
  getMonthGrid,
  getPersianWeekdayLabels,
  isSameDay,
} from "@/shared/utils/jalali";

describe("jalali utils", () => {
  it("generates a 42-cell month grid with current-month flags", () => {
    const grid = getMonthGrid(new Date(2026, 1, 1));
    expect(grid).toHaveLength(42);
    expect(grid.some((cell) => cell.isCurrentMonth)).toBe(true);
    expect(grid.some((cell) => !cell.isCurrentMonth)).toBe(true);
  });

  it("formats month-year, long date, and day number in Persian calendar", () => {
    const date = new Date(2026, 1, 1, 12);
    expect(formatJalaliMonthYear(date).length).toBeGreaterThan(3);
    expect(formatJalaliLongDate(date).length).toBeGreaterThan(6);
    expect(formatJalaliDayNumber(date).length).toBeGreaterThan(0);
  });

  it("returns seven weekday labels", () => {
    const labels = getPersianWeekdayLabels();
    expect(labels).toHaveLength(7);
    expect(labels.every((label) => label.length > 0)).toBe(true);
  });

  it("detects same day correctly using local calendar fields", () => {
    expect(
      isSameDay(new Date(2026, 1, 1, 10), new Date(2026, 1, 1, 20)),
    ).toBe(true);

    expect(
      isSameDay(new Date(2026, 1, 1, 10), new Date(2026, 1, 2, 10)),
    ).toBe(false);
  });
});
