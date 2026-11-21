import { defineConfig } from "vitest/config";
import path from "node:path";

// Database tests (`npm run test:db`): run against the local Supabase stack
// (`npx supabase start`), one file at a time, in node.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.db.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
});
