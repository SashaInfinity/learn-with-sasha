/** @type {import('tailwindcss').Config} */
export default {
  // Scan all source files for class usage so unused utilities are tree-shaken.
  content: ['./index.html', './src/**/*.{ts,tsx}', './*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Rajdhani is loaded via Google Fonts in index.html
        sans: ['Rajdhani', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
