#!/usr/bin/env node
// Verify the packaged WebView entry point and the exact current Vite assets.
// Only names and digests are printed: never print app JavaScript or config.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const [apk] = process.argv.slice(2);
if (!apk)
  throw new Error("Usage: node scripts/verify-android-assets.mjs <apk>");
const packaged = (name) => execFileSync("unzip", ["-p", apk, `assets/${name}`]);
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const entry = packaged("index.html");
const localEntry = readFileSync("dist/mobile/index.html");
if (!entry.equals(localEntry))
  throw new Error("APK entry differs from the Vite build");
const html = entry.toString("utf8");
const assets = [
  ...html.matchAll(/(?:src|href)="\.\/(assets\/index-[\w-]+\.(?:js|css))"/g),
].map((m) => m[1]);
if (
  assets.length !== 2 ||
  !assets.some((s) => s.endsWith(".css")) ||
  !assets.some((s) => s.endsWith(".js"))
) {
  throw new Error("Expected one hashed JS and CSS bundle in the WebView entry");
}
for (const name of assets) {
  const inApk = packaged(name);
  const built = readFileSync(resolve("dist/mobile", name));
  if (!inApk.equals(built))
    throw new Error(`APK asset differs from current build: ${name}`);
  if (name.endsWith(".css")) {
    const css = inApk.toString("utf8").toLowerCase();
    for (const marker of [
      "#f5ebdd",
      "#85875d",
      "#c98268",
      ".home-ref-stats",
      ".today-ref-grid",
      ".chore-ref-tabs",
    ]) {
      if (!css.includes(marker))
        throw new Error(`Missing expected UI marker: ${marker}`);
    }
  }
  console.log(`${name}: sha256 ${digest(inApk)}`);
}
console.log(`index.html: sha256 ${digest(entry)}`);
console.log(
  "Verified bundled build and palette markers; visual rendering still requires a device test.",
);
