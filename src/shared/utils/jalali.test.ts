import { describe, expect, it } from "vitest";
import {
  formatJalaliMonthYear,
  getMonthGrid,
  isSameDay,
  shiftJalaliMonth,
} from "@/shared/utils/jalali";

describe("jalali utils", () => {
  it("generates a 42-cell month grid", () => {
    const grid = getMonthGrid(new Date("2026-02-01T00:00:00.000Z"));
    expect(grid).toHaveLength(42);
  });

  it("formats month-year in Persian calendar", () => {
    const label = formatJalaliMonthYear(new Date("2026-02-01T00:00:00.000Z"));
    expect(label.length).toBeGreaterThan(3);
  });

  it("detects same day correctly", () => {
    expect(
      isSameDay(
        new Date("2026-02-01T10:00:00.000Z"),
        new Date("2026-02-01T20:00:00.000Z"),
      ),
    ).toBe(true);
  });
});

describe("Persian month boundaries", () => {
  it("navigates across Persian year boundaries in both directions", () => {
    const farvardin = new Date(2026, 2, 22, 12);
    const previous = shiftJalaliMonth(farvardin, -1);
    const next = shiftJalaliMonth(farvardin, 1);
    expect(formatJalaliMonthYear(previous)).toBe(
      formatJalaliMonthYear(new Date(2026, 2, 1, 12)),
    );
    expect(formatJalaliMonthYear(next)).toBe(
      formatJalaliMonthYear(new Date(2026, 3, 22, 12)),
    );
    expect(formatJalaliMonthYear(shiftJalaliMonth(previous, 1))).toBe(
      formatJalaliMonthYear(farvardin),
    );
  });
  it("shows exactly the current Persian month, starting the grid on Saturday", () => {
    const date = new Date(2026, 2, 22, 12); // Farvardin 1405
    const grid = getMonthGrid(date);
    const current = grid.filter((cell) => cell.isCurrentMonth);
    expect(grid[0].date.getDay()).toBe(6);
    expect(current).toHaveLength(31);
    expect(formatJalaliMonthYear(current[0].date)).toBe(
      formatJalaliMonthYear(date),
    );
    expect(current[0].date.getDate()).toBe(21);
  });
});
