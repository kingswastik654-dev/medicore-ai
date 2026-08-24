import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "Nunito",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Arial",
          "sans-serif",
        ],
        display: ["var(--font-display)"],
        mono: ["ui-monospace", "SFMono-Regular", "Consolas", "Liberation Mono", "monospace"],
      },
      colors: {
        navy: "#0D1F3C",
        clinical: {
          50: "#F4F7FC",
          100: "#F0F4FF",
          200: "#D6E2FF",
          500: "#1863DE",
          600: "#1B4FD8",
          700: "#1642AE",
        },
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(15 23 42 / 0.04), 0 4px 16px -2px rgb(15 23 42 / 0.06)",
        pop: "0 8px 30px -6px rgb(15 23 42 / 0.18)",
      },
    },
  },
  plugins: [],
};

export default config;
