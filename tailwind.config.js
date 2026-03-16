/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        "brand-dark": "#1e293b",
        "surface": "#f1f5f9",
        "card-border": "#cbd5e1",
        "navy": "#1e3a5f",
        "navy-light": "#2a4a6f",
        "accent": "#0d9488"
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};
