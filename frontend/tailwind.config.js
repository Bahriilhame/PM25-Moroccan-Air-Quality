/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        dark:  '#0F1117',
        card:  '#1A1D27',
        border:'#2A2D3E',
      },
    },
  },
  plugins: [],
}
