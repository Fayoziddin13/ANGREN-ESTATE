import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  // Never let Vite pick up the project's .env / .env.local (they point at production).
  // Tests read only .env.test.local, through tests/setup/env.ts.
  envDir: path.resolve(__dirname, "tests/setup/no-env"),
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup/env.ts"],
    testTimeout: 20000,
  },
});
