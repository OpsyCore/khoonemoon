import { describe, expect, it } from "vitest";
import { formatPersianDate, toPersianNumber } from "./locale";

describe("locale utilities", () => {
  it("formats numbers in Persian digits", () => {
    expect(toPersianNumber(123456)).toBe("۱۲۳٬۴۵۶");
  });

  it("returns a non-empty Persian date string", () => {
    const output = formatPersianDate(new Date("2026-01-10T08:00:00.000Z"));
    expect(output.length).toBeGreaterThan(4);
  });
});
