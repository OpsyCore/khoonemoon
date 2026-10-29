import { describe, expect, it } from "vitest";
import { formatGroupedAmount, parseAmount } from "@/shared/utils/amount";

describe("parseAmount", () => {
  it("parses plain digits", () => {
    expect(parseAmount("1250000")).toBe(1_250_000);
  });

  it("parses Persian digits with separators", () => {
    expect(parseAmount("۴۵۰٬۰۰۰")).toBe(450_000);
    expect(parseAmount("۱٬۲۵۰٬۰۰۰")).toBe(1_250_000);
  });

  it("parses Arabic digits", () => {
    expect(parseAmount("١٢٠٠")).toBe(1200);
  });

  it("tolerates surrounding spaces", () => {
    expect(parseAmount("  1,250,000 ")).toBe(1_250_000);
  });

  it("keeps decimals", () => {
    expect(parseAmount("1250.75")).toBe(1250.75);
  });

  it("accepts zero", () => {
    expect(parseAmount("0")).toBe(0);
  });

  it("rejects empty, junk and negative input", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("   ")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("-5")).toBeNull();
  });
});

describe("formatGroupedAmount", () => {
  it("groups thousands in Persian digits", () => {
    expect(formatGroupedAmount(1_250_000)).toBe("۱٬۲۵۰٬۰۰۰");
  });

  it("rounds to whole numbers", () => {
    expect(formatGroupedAmount(1250.6)).toBe("۱٬۲۵۱");
  });

  it("shows a dash for a non-finite value", () => {
    expect(formatGroupedAmount(Number.NaN)).toBe("—");
  });
});
