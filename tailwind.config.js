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
        brand: {
          blue: '#003399', // National Team Primary
          gold: '#FFCC00', // National Team Accent
          dark: '#001F5C', // Dark Background
        },
        status: {
          danger: '#DC2626',
          success: '#10B981',
          warning: '#F59E0B',
        }
      }
    },
  },
  plugins: [],
}
