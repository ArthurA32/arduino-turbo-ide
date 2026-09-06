/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        arduino: {
          teal: "#00979C",
          darkTeal: "#008184",
          lightTeal: "#00B4B9",
          orange: "#E47128",
          dark: "#1E1E1E",
          panel: "#252526",
          header: "#2D2D2D",
          border: "#3E3E42",
          text: "#CCCCCC",
          hover: "#333333"
        }
      }
    },
  },
  plugins: [],
}
