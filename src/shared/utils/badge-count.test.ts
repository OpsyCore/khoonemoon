import { describe, expect, it } from "vitest";
import {
  BADGE_CAP,
  describeBadge,
  formatBadgeCount,
  toPersianDigits,
} from "@/shared/utils/badge-count";

describe("formatBadgeCount", () => {
  it("returns null for zero, negatives and junk", () => {
    expect(formatBadgeCount(0)).toBeNull();
    expect(formatBadgeCount(-3)).toBeNull();
    expect(formatBadgeCount(Number.NaN)).toBeNull();
  });

  it("renders small counts in Persian digits", () => {
    expect(formatBadgeCount(1)).toBe("۱");
    expect(formatBadgeCount(9)).toBe("۹");
  });

  it("caps larger counts", () => {
    expect(formatBadgeCount(10)).toBe("۹+");
    expect(formatBadgeCount(250)).toBe("۹+");
  });

  it("floors fractional input", () => {
    expect(formatBadgeCount(3.9)).toBe("۳");
  });

  it("keeps the cap at a single digit", () => {
    expect(BADGE_CAP).toBeLessThan(10);
  });
});

describe("describeBadge", () => {
  it("spells out what the number means", () => {
    expect(describeBadge(3)).toBe("۳ یادآور رسیده");
    expect(describeBadge(0)).toBe("");
  });

  it("accepts a custom noun", () => {
    expect(describeBadge(2, "قبض سررسیدشده")).toBe("۲ قبض سررسیدشده");
  });
});

describe("toPersianDigits", () => {
  it("does not group digits", () => {
    expect(toPersianDigits(1234)).not.toContain("٬");
    expect(toPersianDigits(7)).toBe("۷");
  });
});
