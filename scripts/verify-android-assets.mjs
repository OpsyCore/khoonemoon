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
const manifest = packaged("precache.json");
if (!manifest.equals(readFileSync("dist/mobile/precache.json")))
  throw new Error("APK asset manifest differs from the Vite build");
const assets = JSON.parse(manifest.toString("utf8"));
if (
  !Array.isArray(assets) ||
  !assets.some((s) => s.endsWith(".js")) ||
  !assets.some((s) => s.endsWith(".css"))
)
  throw new Error("Missing expected JS or CSS in asset manifest");
const cssParts = [];
for (const name of assets) {
  if (
    typeof name !== "string" ||
    !/^assets\/[\w/-]+\.(?:js|css|woff2|png|webp|svg)$/.test(name)
  )
    throw new Error("Invalid asset manifest path");
  const inApk = packaged(name);
  const built = readFileSync(resolve("dist/mobile", name));
  if (!inApk.equals(built))
    throw new Error(`APK asset differs from current build: ${name}`);
  if (name.endsWith(".css"))
    cssParts.push(inApk.toString("utf8").toLowerCase());
}
const css = cssParts.join("\n");
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
console.log(`Verified ${assets.length} bundled assets from precache manifest.`);
console.log(`index.html: sha256 ${digest(entry)}`);
console.log(
  "Verified bundled build and palette markers; visual rendering still requires a device test.",
);
