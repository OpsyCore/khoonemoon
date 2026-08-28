import { describe, expect, it } from "vitest";
import {
  applySearchQueryToPath,
  normalizeSearchQuery,
  parseSearchQuery,
  readSearchQueryParam,
  sanitizeSearchTerm,
  toOrIlikeFilter,
} from "./query";

describe("parseSearchQuery", () => {
  it("rejects empty and whitespace queries", () => {
    expect(parseSearchQuery({ q: "" }).ok).toBe(false);
    expect(parseSearchQuery({ q: "   " }).ok).toBe(false);
    expect(parseSearchQuery({ q: null }).ok).toBe(false);
  });

  it("rejects queries longer than 80 characters", () => {
    const result = parseSearchQuery({ q: "آ".repeat(81) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("TOO_LONG");
  });

  it("trims and collapses whitespace", () => {
    const result = parseSearchQuery({ q: "  قبض   برق  " });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.query).toBe("قبض برق");
  });

  it("strips ilike/or metacharacters", () => {
    expect(sanitizeSearchTerm("100%_(ok)")).toBe("100 ok");
    expect(normalizeSearchQuery("  a\n b  ")).toBe("a b");
  });

  it("defaults invalid type filters to all", () => {
    const result = parseSearchQuery({ q: "نان", type: "secret" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.type).toBe("all");
  });
});

describe("toOrIlikeFilter", () => {
  it("builds a PostgREST or ilike clause", () => {
    expect(toOrIlikeFilter(["title", "description"], "نان")).toBe(
      "title.ilike.%نان%,description.ilike.%نان%",
    );
  });
});

describe("search page query string", () => {
  it("reads the first q param and trims it", () => {
    expect(readSearchQueryParam("  قبض برق  ")).toBe("قبض برق");
    expect(readSearchQueryParam(["نان", "ignored"])).toBe("نان");
    expect(readSearchQueryParam(undefined)).toBe("");
  });

  it("writes q for deep-link and back navigation without dropping other params", () => {
    expect(
      applySearchQueryToPath({
        pathname: "/search",
        search: "",
        query: " نان ",
      }),
    ).toBe("/search?q=%D9%86%D8%A7%D9%86");

    expect(
      applySearchQueryToPath({
        pathname: "/search",
        search: "?type=finance",
        query: "",
      }),
    ).toBe("/search?type=finance");
  });
});
