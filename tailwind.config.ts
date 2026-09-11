import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#16543C",
          "primary-hover": "#1C684B",
          dark: "#0E3324",
          deep: "#082017",
          light: "#EAF3EF",
          "light-hover": "#D7E9E0",
          border: "#E2EAE5",
          "border-dark": "#C9D7CF",
          canvas: "#F8FAF9",
          card: "#FFFFFF",
          text: "#0E241B",
          muted: "#50645B",
          subtle: "#80948B",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"Segoe UI"',
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        subtle: "0 1px 3px 0 rgba(14, 51, 36, 0.04), 0 1px 2px -1px rgba(14, 51, 36, 0.03)",
        card: "0 4px 20px -2px rgba(14, 51, 36, 0.06), 0 2px 6px -1px rgba(14, 51, 36, 0.03)",
        elevated: "0 12px 32px -4px rgba(14, 51, 36, 0.08), 0 4px 12px -2px rgba(14, 51, 36, 0.04)",
        float: "0 20px 40px -8px rgba(14, 51, 36, 0.12)",
      },
      borderRadius: {
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
    },
  },
  plugins: [],
};
export default config;
