import { describe, expect, it } from "vitest";
import {
  parseTheme,
  readTheme,
  resolveTheme,
  writeTheme,
  THEME_KEY,
} from "../../../mobile/src/theme";
describe("mobile theme selection", () => {
  it("validates stored values and defaults to system", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("system")).toBe("system");
    expect(parseTheme("bogus")).toBe("system");
  });
  it("obeys the system only when selected", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
  });
  it("persists only the theme and handles unavailable storage", () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => {
        data.set(k, v);
      },
    };
    expect(writeTheme(storage, "dark")).toBe(true);
    expect(data.get(THEME_KEY)).toBe("dark");
    expect(readTheme(storage)).toBe("dark");
    expect(
      readTheme({
        getItem: () => {
          throw Error();
        },
      }),
    ).toBe("system");
    expect(
      writeTheme(
        {
          setItem: () => {
            throw Error();
          },
        },
        "light",
      ),
    ).toBe(false);
  });
});
