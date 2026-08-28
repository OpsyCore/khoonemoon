import { describe, expect, it } from "vitest";
import {
  formatPersianDate,
  formatPersianTime,
  toPersianNumber,
} from "./locale";

describe("locale utilities", () => {
  it("formats numbers in Persian digits", () => {
    expect(toPersianNumber(123456)).toBe("۱۲۳٬۴۵۶");
    expect(toPersianNumber("7")).toBe("۷");
  });

  it("returns a non-empty Persian date string", () => {
    const output = formatPersianDate(new Date("2026-01-10T08:00:00.000Z"));
    expect(output.length).toBeGreaterThan(4);
  });

  it("returns a Persian time string", () => {
    const output = formatPersianTime(new Date(2026, 0, 10, 8, 5));
    expect(output.length).toBeGreaterThan(3);
  });
});
