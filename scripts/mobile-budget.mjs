import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { pathToFileURL } from "node:url";

// Sum individually compressed assets, matching separate browser requests.
export function measureMobileJs(files) {
  const js = files.filter(({ name }) => name.endsWith(".js"));
  if (!js.length)
    throw new Error("Standalone build contains no JavaScript assets.");
  return js.reduce((total, file) => total + gzipSync(file.bytes).length, 0);
}

/** Follow only static imports from the single Vite HTML entry. Dynamic imports
 * are excluded until used. Shared chunks are visited once, even with cycles. */
export function initialMobileFiles(manifest) {
  const entries = Object.entries(manifest).filter(([, item]) => item.isEntry);
  if (entries.length !== 1)
    throw new Error("Expected exactly one mobile entry in Vite manifest.");
  const visited = new Set();
  const files = new Set();
  function visit(key) {
    if (visited.has(key)) return;
    const item = manifest[key];
    if (
      !item ||
      typeof item.file !== "string" ||
      !/^assets\/[\w-]+\.js$/.test(item.file)
    )
      throw new Error(`Invalid or missing mobile manifest chunk: ${key}`);
    visited.add(key);
    files.add(item.file.slice("assets/".length));
    for (const dependency of item.imports ?? []) visit(dependency);
  }
  visit(entries[0][0]);
  return files;
}
export function checkMobileBudget(bytes, limit, label = "Mobile JS") {
  if (!Number.isSafeInteger(limit) || limit <= 0)
    throw new Error(`Invalid ${label} budget.`);
  if (bytes > limit)
    throw new Error(`${label} gzip ${bytes} exceeds budget ${limit}.`);
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const root = "dist/mobile";
  const dir = join(root, "assets");
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".js"))
    .map((name) => ({ name, bytes: readFileSync(join(dir, name)) }));
  const manifest = JSON.parse(
    readFileSync(join(root, ".vite/manifest.json"), "utf8"),
  );
  const initialNames = initialMobileFiles(manifest);
  const initialFiles = files.filter(({ name }) => initialNames.has(name));
  if (initialFiles.length !== initialNames.size)
    throw new Error("Initial chunk missing from build assets.");
  const initial = measureMobileJs(initialFiles);
  const total = measureMobileJs(files);
  const budgets = JSON.parse(readFileSync("bundle-budget.json", "utf8"));
  console.log(
    `Initial JavaScript: ${initial} gzip bytes / ${budgets.mobileInitialMaxGzipBytes}`,
  );
  console.log(
    `Total JavaScript: ${total} gzip bytes / ${budgets.mobileMaxGzipBytes}`,
  );
  let failed = false;
  for (const [label, bytes, limit] of [
    ["Initial JS", initial, budgets.mobileInitialMaxGzipBytes],
    ["Total JS", total, budgets.mobileMaxGzipBytes],
  ]) {
    try {
      checkMobileBudget(bytes, limit, label);
    } catch (error) {
      console.error(error.message);
      failed = true;
    }
  }
  if (failed) process.exitCode = 1;
}
