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
export function checkMobileBudget(bytes, limit) {
  if (!Number.isSafeInteger(limit) || limit <= 0)
    throw new Error("Invalid mobile JS budget.");
  if (bytes > limit)
    throw new Error(`Mobile JS gzip ${bytes} exceeds budget ${limit}.`);
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const dir = "dist/mobile/assets";
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".js"))
    .map((name) => ({ name, bytes: readFileSync(join(dir, name)) }));
  const bytes = measureMobileJs(files);
  const { mobileMaxGzipBytes } = JSON.parse(
    readFileSync("bundle-budget.json", "utf8"),
  );
  console.log(
    `Standalone JavaScript: ${bytes} gzip bytes / ${mobileMaxGzipBytes}`,
  );
  checkMobileBudget(bytes, mobileMaxGzipBytes);
}
