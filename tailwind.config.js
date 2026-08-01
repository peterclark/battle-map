/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Dark parchment-and-iron war table: the board is lit from a
        // projector or an LCD lying flat, so surfaces stay dark and the
        // ink stays high-contrast
        table: {
          950: "#0b0906",
          900: "#141009",
          800: "#1e1811",
          700: "#2c231a",
          600: "#3d3125",
        },
        parchment: {
          100: "#f2e7d0",
          200: "#e3d3b0",
          300: "#c9b48c",
          400: "#a08a63",
        },
        ember: "#e07a3c",
        blood: "#a8302c",
        gold: "#d9a441",
      },
      fontFamily: {
        display: ["Cinzel", "Trajan Pro", "Georgia", "serif"],
        body: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
