import { describe, expect, it } from "vitest";
import { checkMobileBudget, measureMobileJs } from "./mobile-budget.mjs";

describe("standalone bundle budget", () => {
  it("counts each JS chunk, ignores CSS and enforces its limit", () => {
    const a = { name: "a.js", bytes: Buffer.from("hello") };
    const b = { name: "b.js", bytes: Buffer.from("hello") };
    const one = measureMobileJs([a]);
    expect(
      measureMobileJs([a, b, { name: "x.css", bytes: Buffer.alloc(10000) }]),
    ).toBe(one * 2);
    expect(() => checkMobileBudget(one, one)).not.toThrow();
    expect(() => checkMobileBudget(one, one - 1)).toThrow();
    expect(() => measureMobileJs([])).toThrow();
    expect(() => checkMobileBudget(one, 0)).toThrow();
  });
});
