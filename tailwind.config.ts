import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        work: "#ef4444",
        shortBreak: "#22c55e",
        longBreak: "#3b82f6",
      },
    },
  },
  plugins: [],
} satisfies Config;
