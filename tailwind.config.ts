import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        velvet: {
          black: "#080808",
          charcoal: "#171717",
          soft: "#242424",
          surface: "#1f1f1f",
          border: "#2e2e2e",
        },
        brand: {
          rose: "#C99A8A",
          roseLight: "#DFB8AA",
          champagne: "#D8B58A",
          champagneLight: "#E8CDAC",
          cream: "#F6EFE7",
          muted: "#A8A29E",
          success: "#6FAF82",
          warning: "#D6A34A",
          error: "#C96B6B",
        },
      },
      fontFamily: {
        serif: ["var(--font-playfair)", "Playfair Display", "Georgia", "serif"],
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;

