/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        stellar: '#14142B',
        accent: '#5E17EB',
      }
    },
  },
  plugins: [],
}
