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
        // Identidade New Holland Construction: PRETO + AMARELO.
        // "brand" = escala grafite/preto (estrutura). "agro" = amarelo NH (destaque).
        brand: {
          50: "#f6f6f7",
          100: "#ededef",
          200: "#d8d8dc",
          300: "#b4b4ba",
          400: "#85858d",
          500: "#62626a",
          600: "#3f3f46",
          700: "#2a2a2e",
          800: "#1c1c1f",
          900: "#141416",
          950: "#0a0a0b",
        },
        agro: {
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#ffcb2d",
          500: "#ffb81c",
          600: "#e09e00",
          700: "#b97e00",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      backgroundOpacity: {
        8: "0.08",
      },
    },
  },
  plugins: [],
};

export default config;
