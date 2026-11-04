import { describe, expect, it } from "vitest";
import {
  ledgerCurrency,
  ledgerFromUrl,
  ledgerUrl,
} from "../../../mobile/src/ledger-url";
describe("standalone ledger links", () => {
  it("round trips filters without dropping unrelated parameters", () => {
    const filters = {
      type: "BILL",
      paid: "UNPAID",
      days: "30",
      query: "برق",
    } as const;
    const url = ledgerUrl(
      new URL("https://example.test/app/?other=1&ledger_type=old"),
      filters,
      "USD",
    );
    expect(url.searchParams.get("other")).toBe("1");
    expect(url.searchParams.get("page")).toBe("finance");
    expect(ledgerFromUrl(url)).toEqual(filters);
    expect(ledgerCurrency(url)).toBe("USD");
    expect(
      ledgerCurrency(new URL("https://example.test/?ledger_currency=bad")),
    ).toBe("IRR");
  });
});
