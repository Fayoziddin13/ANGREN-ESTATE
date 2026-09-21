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
          dark: "#0b3824",
          "primary-dark": "#0b3824",
          primary: "#167d4f",
          "primary-hover": "#1b8d5a",
          "primary-medium": "#145d3c",
          "primary-light": "#2db477",
          secondary: "#145d3c",
          accent: "#167d4f",
          light: "#eaf5f0",
          "light-hover": "#dcf0e6",
          "surface-soft": "#eaf5f0",
          border: "#dee8e3",
          "border-dark": "#bdd1c8",
          canvas: "#fbfcfb",
          card: "#ffffff",
          text: "#07311e",
          "text-secondary": "#3b6854",
          muted: "#3b6854",
          subtle: "#628b78",
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
