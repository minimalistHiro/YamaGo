/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'oni-red': '#ef4444',
        'runner-green': '#22c55e',
        'boundary-blue': '#3b82f6',
      },
    },
  },
  plugins: [],
};
