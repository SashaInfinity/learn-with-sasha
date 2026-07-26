/** @type {import('tailwindcss').Config} */
export default {
  // Scan all source files for class usage so unused utilities are tree-shaken.
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Match sasha_lms: Inter for body/UI, Lexend Deca for headings.
        sans: ['Inter', 'sans-serif'],
        heading: ['Lexend Deca', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
