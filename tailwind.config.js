/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fef7ee',
          100: '#fdedd6',
          200: '#fad7ad',
          300: '#f6bb79',
          400: '#f19443',
          500: '#ed751e',
          600: '#de5b14',
          700: '#b84413',
          800: '#933717',
          900: '#772f16',
          950: '#401509',
        },
      },
    },
  },
  plugins: [],
}
