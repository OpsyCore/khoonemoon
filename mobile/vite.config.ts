import { defineConfig, loadEnv } from "vite";
import { resolve } from "node:path";
import {
  mobileConnectSources,
  mobileRuntimeAttributes,
  validateMobileConfig,
} from "./build-config";

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
          return html
            .replace(
              "%SUPABASE_CONNECT_SOURCES%",
              mobileConnectSources(env.VITE_SUPABASE_URL),
            )
            .replace(
              "%SUPABASE_RUNTIME_CONFIG%",
              mobileRuntimeAttributes(
                env.VITE_SUPABASE_URL,
                env.VITE_SUPABASE_ANON_KEY,
              ),
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
                name: "task-event-forms",
                test: /[\\/]mobile[\\/]src[\\/](new-task|new-event)\.tsx$|[\\/]mobile[\\/]src[\\/]reminder-followup\.ts$|[\\/]src[\\/]features[\\/]calendar[\\/]occasions\.ts$/,
                includeDependenciesRecursively: false,
              },
              {
                name: "deferred-icons",
                test: /lucide-react[\\/]dist[\\/]esm[\\/]icons[\\/](alarm-clock|apple|arrow-down|chevron-right|arrow-down-right|arrow-up|arrow-up-right|ban|circle-check|circle-dollar-sign|circle-plus|clock|clock-3|copy|database|ellipsis|ellipsis-vertical|file-down|flag|handshake|heart|info|layers|lightbulb|list|map|map-pin|monitor|moon|palette|pencil|plus|refresh-cw|scale|shield|shopping-basket|shopping-cart|smartphone|soup|sparkles|spray-can|sprout|square-check|square-check-big|sun|sunrise|trash|triangle-alert|utensils|users|users-round)\.mjs$/,
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
