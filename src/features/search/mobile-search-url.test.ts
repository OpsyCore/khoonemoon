import { describe, expect, it } from "vitest";
import { searchUrl } from "../../../mobile/src/search-url";
describe("search link", () => {
  it("opens search after switching from a financial link and preserves other params", () => {
    const url = searchUrl(
      new URL("https://example.test/?page=finance&ledger_currency=USD"),
      "قبض",
      { kinds: ["finance"], range: "MONTH" },
    );
    expect(url.searchParams.get("page")).toBe("search");
    expect(url.searchParams.get("search_q")).toBe("قبض");
    expect(url.searchParams.get("ledger_currency")).toBe("USD");
  });
});
