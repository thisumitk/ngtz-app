import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: ["JetBrains Mono", "monospace"],
        display: ["Space Mono", "monospace"],
      },
      colors: {
        ngtz: {
          bg: "#080808",
          card: "#0d0d0d",
          border: "#1a1a1a",
          green: "#22c55e",
          yellow: "#eab308",
          red: "#ef4444",
          muted: "#555555",
        },
      },
    },
  },
  plugins: [],
};

export default config;
