/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Aplica Plus Jakarta Sans a todo el cuerpo e interfaz
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        // Tipografía para títulos principales/números si querés mantener el estilo editorial
        serif: ['Fraunces', 'serif'],
      },
      colors: {
        paper: "#f5f0e8",
        ink: "#1d2939",
        teal: "#0d6b63",
        orange: "#df7c38",
        line: "#d8d1c4",
        cream: "#fffdf8",
      }
    },
  },
  plugins: [],
}