/** @type {import('tailwindcss').Config} */
export default {
  // Scan all source files for class usage so unused utilities are tree-shaken.
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Single typeface per the mockup — Plus Jakarta Sans everywhere.
        sans: ['Plus Jakarta Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
