import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
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
  it("checks initial and total independently from the CLI", () => {
    const dir = mkdtempSync(join(tmpdir(), "mobile-budget-"));
    const script = resolve("scripts/mobile-budget.mjs");
    try {
      mkdirSync(join(dir, "dist/mobile/assets"), { recursive: true });
      mkdirSync(join(dir, "dist/mobile/.vite"), { recursive: true });
      const initial = Buffer.from("initial fixture data");
      const deferred = Buffer.from("deferred fixture data");
      writeFileSync(join(dir, "dist/mobile/assets/main.js"), initial);
      writeFileSync(join(dir, "dist/mobile/assets/lazy.js"), deferred);
      writeFileSync(
        join(dir, "dist/mobile/.vite/manifest.json"),
        JSON.stringify({
          entry: {
            file: "assets/main.js",
            isEntry: true,
            dynamicImports: ["lazy"],
          },
          lazy: { file: "assets/lazy.js", isDynamicEntry: true },
        }),
      );
      const first = measureMobileJs([{ name: "main.js", bytes: initial }]);
      const total = measureMobileJs([
        { name: "main.js", bytes: initial },
        { name: "lazy.js", bytes: deferred },
      ]);
      const config = (i, t) =>
        writeFileSync(
          join(dir, "bundle-budget.json"),
          JSON.stringify({
            mobileInitialMaxGzipBytes: i,
            mobileMaxGzipBytes: t,
          }),
        );
      const run = (mode) =>
        spawnSync(process.execPath, [script, mode], {
          cwd: dir,
          encoding: "utf8",
        });
      config(first, total - 1);
      expect(run("initial").status).toBe(0);
      expect(run("total").status).toBe(1);
      expect(run("all").stderr).toContain("Total JS gzip");
      config(first - 1, total);
      expect(run("initial").status).toBe(1);
      expect(run("total").status).toBe(0);
      expect(run("all").stderr).toContain("Initial JS gzip");
      config(first, total);
      expect(run("all").status).toBe(0);
      expect(run("invalid").status).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
