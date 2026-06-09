import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["src/__tests__/setup.ts"],
    globals: true,
    coverage: {
      provider: "v8",
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      },
      exclude: [
        "src/__tests__/**",
        "*.config.*",
        "src/popup/main.tsx",
        "src/background/index.ts",
        "src/shared/types.ts",
        "node_modules/**",
        "*.js",
        "*.html",
        "*.css",
      ],
    },
  },
});
