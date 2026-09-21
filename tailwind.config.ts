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
          dark: "#0c2e1f",
          "primary-dark": "#0c2e1f",
          primary: "#19573c",
          "primary-hover": "#206e4d",
          "primary-medium": "#206e4d",
          "primary-light": "#257f59",
          secondary: "#206e4d",
          accent: "#339e71",
          light: "#e5f0eb",
          "light-hover": "#d5e7dd",
          "surface-soft": "#e5f0eb",
          border: "#e2e9e6",
          "border-dark": "#c2d3c9",
          canvas: "#f9fbfa",
          card: "#ffffff",
          text: "#0c2e1f",
          "text-secondary": "#43705c",
          muted: "#43705c",
          subtle: "#6f9984",
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
