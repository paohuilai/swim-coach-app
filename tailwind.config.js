/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'dolphin-blue': '#00008B',
        'dolphin-gold': '#FFD700',
      }
    },
  },
  plugins: [],
}
