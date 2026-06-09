import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: [
    "src/background/index.ts",
    "src/popup/main.tsx",
  ],
  project: ["src/**/*.{ts,tsx}"],
};

export default config;
