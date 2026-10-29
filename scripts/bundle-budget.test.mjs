import { describe, expect, it } from "vitest";
import {
  evaluateBudgets,
  extractJsonPayload,
  formatBytes,
  parseBuildManifest,
  parseClientReferenceManifest,
  routeFromAppPath,
  summarizeRoute,
} from "./bundle-budget.mjs";

/** A tiny Turbopack-style manifest: JS assignment, JSON payload, trailing `;`. */
function manifestSource(payload) {
  return [
    "globalThis.__RSC_MANIFEST = globalThis.__RSC_MANIFEST || {};",
    'globalThis.__RSC_MANIFEST["/(app)/lists/page"] = ' +
      JSON.stringify(payload) +
      ";",
    "",
  ].join("\n");
}

const PAYLOAD = {
  moduleLoading: { prefix: "", crossOrigin: null },
  clientModules: {},
  entryJSFiles: {
    "[project]/src/app/layout": [
      "/_next/static/chunks/shared.js",
      "/_next/static/chunks/layout.js",
    ],
    "[project]/src/app/(app)/lists/page": [
      "/_next/static/chunks/shared.js",
      "/_next/static/chunks/lists.js",
    ],
  },
  entryCSSFiles: {
    "[project]/src/app/layout": [
      { path: "/_next/static/chunks/app.css", inlined: false },
    ],
  },
};

describe("extractJsonPayload", () => {
  it("slices the object out of the JavaScript assignment", () => {
    const payload = extractJsonPayload(manifestSource({ a: 1 }));

    expect(payload).toEqual({ a: 1 });
  });

  it("ignores braces that appear inside strings", () => {
    const payload = extractJsonPayload(
      manifestSource({ note: "شامل } و { داخل متن" }),
    );

    expect(payload).toEqual({ note: "شامل } و { داخل متن" });
  });

  it("handles escaped quotes", () => {
    const payload = extractJsonPayload(
      manifestSource({ note: 'گیومه‌ی " انگلیسی' }),
    );

    expect(payload).toEqual({ note: 'گیومه‌ی " انگلیسی' });
  });

  it("returns null when the file has no assignment", () => {
    expect(extractJsonPayload("console.log('hi')")).toBeNull();
    expect(extractJsonPayload("")).toBeNull();
  });

  it("returns null instead of throwing on malformed JSON", () => {
    expect(extractJsonPayload("x] = {broken: }")).toBeNull();
  });
});

describe("parseClientReferenceManifest", () => {
  it("collects de-duplicated JS chunks without the /_next/ prefix", () => {
    const { jsChunks } = parseClientReferenceManifest(manifestSource(PAYLOAD));

    expect(jsChunks).toEqual([
      "static/chunks/layout.js",
      "static/chunks/lists.js",
      "static/chunks/shared.js",
    ]);
  });

  it("collects CSS files", () => {
    const { cssFiles } = parseClientReferenceManifest(manifestSource(PAYLOAD));

    expect(cssFiles).toEqual(["static/chunks/app.css"]);
  });

  it("is safe on an unparsable manifest", () => {
    expect(parseClientReferenceManifest("nonsense")).toEqual({
      jsChunks: [],
      cssFiles: [],
    });
  });

  it("tolerates a manifest without entry files", () => {
    expect(parseClientReferenceManifest(manifestSource({ a: 1 }))).toEqual({
      jsChunks: [],
      cssFiles: [],
    });
  });
});

describe("parseBuildManifest", () => {
  it("normalises root and polyfill paths", () => {
    const parsed = parseBuildManifest(
      JSON.stringify({
        rootMainFiles: ["static/chunks/a.js", "static/chunks/b.js"],
        polyfillFiles: ["/_next/static/chunks/polyfill.js"],
      }),
    );

    expect(parsed.rootMainFiles).toEqual([
      "static/chunks/a.js",
      "static/chunks/b.js",
    ]);
    expect(parsed.polyfillFiles).toEqual(["static/chunks/polyfill.js"]);
  });

  it("defaults to empty lists", () => {
    expect(parseBuildManifest("{}")).toEqual({
      rootMainFiles: [],
      polyfillFiles: [],
    });
  });
});

describe("summarizeRoute", () => {
  const files = new Map([
    ["a.js", Buffer.alloc(1000, "a")],
    ["b.js", Buffer.alloc(2000, "b")],
    ["app.css", Buffer.alloc(500, "c")],
  ]);
  const readChunk = (chunk) => files.get(chunk) ?? null;

  it("counts a chunk once even when several entries reference it", () => {
    const summary = summarizeRoute({
      route: "/lists",
      jsChunks: ["a.js", "a.js", "b.js"],
      readChunk,
    });

    expect(summary.jsRaw).toBe(3000);
    expect(summary.chunkCount).toBe(2);
    expect(summary.jsGzip).toBeGreaterThan(0);
    // Gzip of 1000 repeated bytes is far smaller than the raw size.
    expect(summary.jsGzip).toBeLessThan(summary.jsRaw);
  });

  it("skips chunks that do not exist on disk", () => {
    const summary = summarizeRoute({
      route: "/missing",
      jsChunks: ["a.js", "ghost.js"],
      readChunk,
    });

    expect(summary.jsRaw).toBe(1000);
    expect(summary.chunkCount).toBe(2);
  });

  it("adds CSS bytes separately from JS", () => {
    const summary = summarizeRoute({
      route: "/style",
      jsChunks: [],
      cssFiles: ["app.css"],
      readChunk,
    });

    expect(summary.jsGzip).toBe(0);
    expect(summary.cssRaw).toBe(500);
  });
});

describe("evaluateBudgets", () => {
  const budgets = {
    defaultMaxGzipBytes: 1000,
    sharedMaxGzipBytes: 800,
    routes: { "/today": { maxGzipBytes: 2000 } },
  };

  it("passes when every route is inside its budget", () => {
    const result = evaluateBudgets({
      routes: [{ route: "/lists", jsGzip: 900 }],
      shared: { jsGzip: 700 },
      budgets,
    });

    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it("reports a route over the default budget with the overflow", () => {
    const result = evaluateBudgets({
      routes: [{ route: "/lists", jsGzip: 1500 }],
      shared: { jsGzip: 100 },
      budgets,
    });

    expect(result.ok).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({
      scope: "/lists",
      actual: 1500,
      max: 1000,
      overBy: 500,
    });
  });

  it("honours a per-route override", () => {
    const result = evaluateBudgets({
      routes: [{ route: "/today", jsGzip: 1800 }],
      shared: { jsGzip: 0 },
      budgets,
    });

    expect(result.ok).toBe(true);
  });

  it("fails when the shared baseline grows", () => {
    const result = evaluateBudgets({
      routes: [],
      shared: { jsGzip: 900 },
      budgets,
    });

    expect(result.ok).toBe(false);
    expect(result.violations[0].scope).toContain("shared");
  });

  it("skips the shared check when no budget is configured", () => {
    const result = evaluateBudgets({
      routes: [],
      shared: { jsGzip: 10_000 },
      budgets: { defaultMaxGzipBytes: 1000 },
    });

    expect(result.ok).toBe(true);
  });
});

describe("formatBytes / routeFromAppPath", () => {
  it("formats kilobytes and megabytes", () => {
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.00 MB");
  });

  it("maps an app path to a public route", () => {
    expect(
      routeFromAppPath("/(app)/lists/page", { "/(app)/lists/page": "/lists" }),
    ).toBe("/lists");
  });

  it("falls back to the app path when the manifest lacks it", () => {
    expect(routeFromAppPath("/page", {})).toBe("/page");
  });
});
