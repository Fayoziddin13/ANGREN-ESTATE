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
          dark: "#0d3431",
          primary: "#19453c",
          "primary-hover": "#2c5b51",
          "secondary-dark": "#2c5b51",
          secondary: "#2f6857",
          accent: "#8cb599",
          light: "#d9eedb",
          "light-hover": "#c8e6cb",
          border: "#E8ECE9",
          "border-dark": "#C9D7CF",
          canvas: "#F8FAF9",
          card: "#FFFFFF",
          text: "#0d241d",
          muted: "#52665e",
          subtle: "#7e948a",
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
