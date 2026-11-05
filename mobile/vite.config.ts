import { defineConfig, loadEnv } from "vite";
import { resolve } from "node:path";
import { mobileConnectSources, validateMobileConfig } from "./build-config";

const root = resolve(__dirname);
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, root, "VITE_");
  if (command === "build")
    validateMobileConfig(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  return {
    plugins: [
      {
        name: "offline-chunk-manifest",
        enforce: "post",
        generateBundle(_options, bundle) {
          const assets = Object.keys(bundle).filter((name) =>
            /^assets\/[\w./-]+\.(?:js|css|woff2|png|webp|svg)$/.test(name),
          );
          this.emitFile({
            type: "asset",
            fileName: "precache.json",
            source: JSON.stringify(assets.sort()),
          });
        },
      },
      {
        name: "supabase-csp",
        transformIndexHtml(html) {
          return html.replace(
            "%SUPABASE_CONNECT_SOURCES%",
            mobileConnectSources(env.VITE_SUPABASE_URL),
          );
        },
      },
    ],
    root,
    base: "./",
    resolve: { alias: { "@": resolve(__dirname, "../src") } },
    build: {
      outDir: "../dist/mobile",
      emptyOutDir: true,
      manifest: true,
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: "deferred-icons",
                test: /lucide-react[\\/]dist[\\/]esm[\\/]icons[\\/](circle-dollar-sign|clock-3|ellipsis|heart|map-pin|plus|refresh-cw|shopping-basket|shopping-cart|square-check|sun|users|users-round)\.mjs$/,
                includeDependenciesRecursively: false,
              },
            ],
          },
        },
      },
    },
    server: { host: "0.0.0.0", allowedHosts: true },
  };
});
