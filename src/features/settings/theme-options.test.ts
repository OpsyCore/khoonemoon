import { describe, expect, it } from "vitest";
import { isThemeOptionId, THEME_OPTIONS } from "./theme-options";

describe("theme options", () => {
  it("exposes system/light/dark without extra themes", () => {
    expect(THEME_OPTIONS.map((option) => option.id)).toEqual([
      "system",
      "light",
      "dark",
    ]);
    expect(isThemeOptionId("system")).toBe(true);
    expect(isThemeOptionId("sepia")).toBe(false);
  });
});
