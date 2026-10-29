import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve("./src"),
    },
  },
  esbuild: {
    // Next keeps `jsx: preserve`, which esbuild does not understand; tell it
    // explicitly so component tests can be written as .tsx.
    jsx: "automatic",
  },
  test: {
    environment: "node",
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      // Operational scripts (bundle budget, dispatch) are tested too.
      "scripts/**/*.test.mjs",
    ],
  },
});
