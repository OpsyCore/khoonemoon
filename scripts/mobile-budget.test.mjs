import { describe, expect, it } from "vitest";
import {
  checkMobileBudget,
  initialMobileFiles,
  measureMobileJs,
} from "./mobile-budget.mjs";

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
  it("counts the static entry closure once and excludes dynamic entries", () => {
    const graph = {
      entry: {
        file: "assets/main.js",
        isEntry: true,
        imports: ["shared", "other"],
        dynamicImports: ["lazy"],
      },
      shared: { file: "assets/shared.js", imports: ["other"] },
      other: { file: "assets/other.js", imports: ["shared"] },
      lazy: { file: "assets/lazy.js", isDynamicEntry: true },
    };
    expect([...initialMobileFiles(graph)].sort()).toEqual([
      "main.js",
      "other.js",
      "shared.js",
    ]);
  });
  it("rejects missing entries, dependencies and unsafe paths", () => {
    expect(() => initialMobileFiles({})).toThrow();
    expect(() =>
      initialMobileFiles({
        x: { file: "assets/x.js", isEntry: true, imports: ["missing"] },
      }),
    ).toThrow();
    expect(() =>
      initialMobileFiles({ x: { file: "../x.js", isEntry: true } }),
    ).toThrow();
  });
});
