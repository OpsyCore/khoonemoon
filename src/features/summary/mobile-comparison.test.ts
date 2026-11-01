import { describe, expect, it } from "vitest";
import { spendingComparison } from "../../../mobile/src/weekly-comparison";
describe("weekly spending comparison", () => {
  it("does not invent a percentage without baseline and distinguishes increase/decrease", () => {
    expect(spendingComparison(null)).toContain("مقایسه");
    expect(spendingComparison(0)).toContain("برابر");
    expect(spendingComparison(25)).toContain("بیشتر");
    expect(spendingComparison(-25)).toContain("کمتر");
  });
});
