import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: "#0f172a",
        card: "#111827",
        accent: "#0ea5e9"
      }
    }
  },
  plugins: []
};

export default config;
