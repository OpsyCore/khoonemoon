import { defineConfig, loadEnv } from "vite";
import { resolve } from "node:path";
import { validateMobileConfig } from "./build-config";

const root = resolve(__dirname);
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, root, "VITE_");
  if (command === "build")
    validateMobileConfig(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  return {
    root,
    base: "./",
    resolve: { alias: { "@": resolve(__dirname, "../src") } },
    build: { outDir: "../dist/mobile", emptyOutDir: true },
    server: { host: "0.0.0.0", allowedHosts: true },
  };
});
