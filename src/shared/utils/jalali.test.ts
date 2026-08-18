import { describe, expect, it } from "vitest";
import {
  formatJalaliMonthYear,
  getMonthGrid,
  isSameDay,
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
