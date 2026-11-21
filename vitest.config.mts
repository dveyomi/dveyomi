import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["**/node_modules/**", "**/*.db.test.ts"],
    passWithNoTests: true,
    setupFiles: ["./src/test/setup.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
});
