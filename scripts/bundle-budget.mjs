/**
 * Bundle budget checks for the production build.
 *
 * The app is a mobile-first PWA: every kilobyte of JavaScript is paid for on a
 * phone with a slow connection. Nothing in CI noticed bundle growth before, so a
 * single careless import could ship silently. This module reads what `next build`
 * actually emitted (Turbopack writes one client-reference manifest per route), so
 * the numbers are real rather than estimates.
 *
 * Pure helpers are exported for `bundle-budget.test.mjs`; `main()` only glues
 * filesystem access to them.
 */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const NEXT_DIR = ".next";
const STATIC_PREFIX = "/_next/";

/**
 * Turbopack's client-reference manifest is JavaScript:
 *   globalThis.__RSC_MANIFEST["/(app)/lists/page"] = { ... };
 * The object is sliced out by brace matching instead of being evaluated.
 */
export function extractJsonPayload(source) {
  const assignment = source.indexOf("] = {");
  if (assignment === -1) return null;

  const start = source.indexOf("{", assignment);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];

    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") depth += 1;

    if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        try {
          return JSON.parse(source.slice(start, index + 1));
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

/**
 * Returns the chunks a route loads (`entryJSFiles`) and the CSS it needs
 * (`entryCSSFiles`). Entries are de-duplicated and normalised to paths relative
 * to `.next`, so callers can read them directly.
 */
export function parseClientReferenceManifest(source) {
  const payload = extractJsonPayload(source);

  if (!payload) return { jsChunks: [], cssFiles: [] };

  const js = new Set();
  const css = new Set();

  for (const chunks of Object.values(payload.entryJSFiles ?? {})) {
    for (const chunk of chunks ?? []) {
      if (typeof chunk !== "string") continue;
      js.add(chunk.replace(STATIC_PREFIX, ""));
    }
  }

  for (const files of Object.values(payload.entryCSSFiles ?? {})) {
    for (const file of files ?? []) {
      if (typeof file?.path !== "string") continue;
      css.add(file.path.replace(STATIC_PREFIX, ""));
    }
  }

  return { jsChunks: [...js].sort(), cssFiles: [...css].sort() };
}

export function parseBuildManifest(source) {
  const manifest = JSON.parse(source);

  return {
    rootMainFiles: (manifest.rootMainFiles ?? []).map((file) =>
      file.replace(STATIC_PREFIX, ""),
    ),
    polyfillFiles: (manifest.polyfillFiles ?? []).map((file) =>
      file.replace(STATIC_PREFIX, ""),
    ),
  };
}

/**
 * Sums the bytes a route transfers, counting a chunk once even when several
 * modules reference it.
 */
export function summarizeRoute({ route, jsChunks, cssFiles = [], readChunk }) {
  let jsRaw = 0;
  let jsGzip = 0;
  let cssRaw = 0;

  for (const chunk of new Set(jsChunks)) {
    const bytes = readChunk(chunk);
    if (!bytes) continue;

    jsRaw += bytes.length;
    jsGzip += zlib.gzipSync(bytes, { level: 9 }).length;
  }

  for (const file of new Set(cssFiles)) {
    const bytes = readChunk(file);
    if (!bytes) continue;

    cssRaw += bytes.length;
  }

  return {
    route,
    jsRaw,
    jsGzip,
    cssRaw,
    chunkCount: new Set(jsChunks).size,
  };
}

export function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

  return `${(bytes / 1024).toFixed(1)} KB`;
}

/**
 * Compares measured sizes against the configured budgets.
 * A route without its own entry falls back to `defaultMaxGzipBytes`.
 */
export function evaluateBudgets({ routes, shared, budgets }) {
  const violations = [];

  const limitFor = (route) =>
    budgets.routes?.[route]?.maxGzipBytes ??
    budgets.defaultMaxGzipBytes ??
    Number.POSITIVE_INFINITY;

  for (const entry of routes) {
    const max = limitFor(entry.route);

    if (entry.jsGzip > max) {
      violations.push({
        scope: entry.route,
        actual: entry.jsGzip,
        max,
        overBy: entry.jsGzip - max,
      });
    }
  }

  if (shared && budgets.sharedMaxGzipBytes) {
    if (shared.jsGzip > budgets.sharedMaxGzipBytes) {
      violations.push({
        scope: "shared (root main files)",
        actual: shared.jsGzip,
        max: budgets.sharedMaxGzipBytes,
        overBy: shared.jsGzip - budgets.sharedMaxGzipBytes,
      });
    }
  }

  return { ok: violations.length === 0, violations };
}

/** `/(app)/lists/page` → `/lists`, using Next's own path manifest. */
export function routeFromAppPath(appPath, appPathRoutes) {
  return appPathRoutes[appPath] ?? appPath;
}

export function collectRouteManifests({ nextDir, appPathRoutes }) {
  const serverAppDir = path.join(nextDir, "server", "app");
  const manifests = [];

  for (const appPath of Object.keys(appPathRoutes)) {
    if (!appPath.endsWith("/page")) continue;

    const file = path.join(
      serverAppDir,
      `${appPath}_client-reference-manifest.js`,
    );
    if (!fs.existsSync(file)) continue;

    manifests.push({
      route: routeFromAppPath(appPath, appPathRoutes),
      source: fs.readFileSync(file, "utf8"),
    });
  }

  return manifests;
}

function main() {
  const budgetFile = path.resolve("bundle-budget.json");

  if (!fs.existsSync(NEXT_DIR)) {
    console.error("✖ پوشهٔ .next پیدا نشد. اول `npm run build` را اجرا کنید.");
    process.exit(1);
  }

  if (!fs.existsSync(budgetFile)) {
    console.error("✖ فایل bundle-budget.json پیدا نشد.");
    process.exit(1);
  }

  const budgets = JSON.parse(fs.readFileSync(budgetFile, "utf8"));
  const appPathRoutes = JSON.parse(
    fs.readFileSync(
      path.join(NEXT_DIR, "app-path-routes-manifest.json"),
      "utf8",
    ),
  );
  const buildManifest = parseBuildManifest(
    fs.readFileSync(path.join(NEXT_DIR, "build-manifest.json"), "utf8"),
  );

  // Chunk paths are relative to `.next` (e.g. `static/chunks/x.js`).
  const cache = new Map();

  const readChunk = (chunk) => {
    if (cache.has(chunk)) return cache.get(chunk);

    const file = path.join(NEXT_DIR, chunk);
    const bytes = fs.existsSync(file) ? fs.readFileSync(file) : null;
    cache.set(chunk, bytes);
    return bytes;
  };

  const routes = collectRouteManifests({ nextDir: NEXT_DIR, appPathRoutes })
    .map(({ route, source }) => {
      const { jsChunks, cssFiles } = parseClientReferenceManifest(source);

      return summarizeRoute({ route, jsChunks, cssFiles, readChunk });
    })
    .sort((a, b) => b.jsGzip - a.jsGzip);

  const shared = summarizeRoute({
    route: "shared",
    jsChunks: buildManifest.rootMainFiles,
    readChunk,
  });

  const { ok, violations } = evaluateBudgets({ routes, shared, budgets });

  console.log("بودجهٔ باندل (JS، gzip)");
  console.log("──────────────────────────────────────────────────────");

  for (const entry of routes) {
    const max =
      budgets.routes?.[entry.route]?.maxGzipBytes ??
      budgets.defaultMaxGzipBytes ??
      0;
    const over = entry.jsGzip > max;

    console.log(
      `${over ? "✖" : "•"} ${entry.route.padEnd(24)}${formatBytes(
        entry.jsGzip,
      ).padStart(9)}  از ${formatBytes(max)}`,
    );
  }

  console.log(
    `• ${"shared (هر صفحه)".padEnd(24)}${formatBytes(shared.jsGzip).padStart(9)}  از ${formatBytes(
      budgets.sharedMaxGzipBytes ?? 0,
    )}`,
  );

  if (!ok) {
    console.error("\n✖ بودجهٔ باندل رد شد:");
    for (const violation of violations) {
      console.error(
        `  ${violation.scope}: ${formatBytes(violation.actual)} > ${formatBytes(
          violation.max,
        )} (${formatBytes(violation.overBy)} بیش از سقف)`,
      );
    }
    console.error(
      "\nیا import اضافه را حذف کنید، یا اگر رشد آگاهانه است bundle-budget.json را به‌روز کنید.",
    );
    process.exit(1);
  }

  console.log("\n✔ همهٔ مسیرها داخل بودجهٔ باندل هستند.");
}

// Only run when invoked directly (tests import the helpers).
const invokedDirectly =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(import.meta.filename);

if (invokedDirectly) main();
