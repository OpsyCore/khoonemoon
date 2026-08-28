import { describe, expect, it } from "vitest";
import type { SearchResult } from "./types";
import {
  mergeSearchResults,
  matchesSearchQuery,
  scoreSearchMatch,
} from "./rank";

function hit(
  type: SearchResult["type"],
  id: string,
  title: string,
  snippet: string | null = null,
): SearchResult {
  return { type, id, title, snippet, href: "/today" };
}

describe("scoreSearchMatch", () => {
  it("ranks exact, prefix, title contains, then extra", () => {
    expect(scoreSearchMatch("نان", "نان", null)).toBe(0);
    expect(scoreSearchMatch("نا", "نان", null)).toBe(1);
    expect(scoreSearchMatch("ان", "نان", null)).toBe(2);
    expect(scoreSearchMatch("خانه", "قبض", "هزینه خانه")).toBe(3);
    expect(scoreSearchMatch("xyz", "نان", "خانه")).toBe(4);
  });

  it("is case-insensitive", () => {
    expect(scoreSearchMatch("Bill", "BILL", null)).toBe(0);
    expect(matchesSearchQuery("milk", "Buy Milk", null)).toBe(true);
  });
});

describe("mergeSearchResults", () => {
  it("drops duplicates and non-matches, then ranks", () => {
    const merged = mergeSearchResults("نان", [
      hit("finance", "1", "نان", null),
      hit("finance", "1", "نان", "dup"),
      hit("task", "2", "خرید نان", null),
      hit("chore", "3", "کار", "نانوایی"),
      hit("event", "4", "مهمانی", "بی‌ربط"),
    ]);

    expect(merged.map((item) => item.id)).toEqual(["1", "2", "3"]);
  });
});
