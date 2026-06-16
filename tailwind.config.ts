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
        // Paleta inspirada na New Holland (azul) com toques de "agro" (amarelo/verde)
        brand: {
          50: "#eef6ff",
          100: "#d9ebff",
          200: "#bcdcff",
          300: "#8ec6ff",
          400: "#59a6ff",
          500: "#2f82ff",
          600: "#1a63f5",
          700: "#164de1",
          800: "#193fb6",
          900: "#1a398f",
          950: "#152357",
        },
        agro: {
          400: "#f9c84e",
          500: "#f5b417",
          600: "#d99708",
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
