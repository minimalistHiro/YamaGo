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
        'cyber-void': '#050810',
        'cyber-grid': '#0b1920',
        'cyber-green': '#22B59B',
        'cyber-purple': '#8A1FBD',
        'cyber-pink': '#FF47C2',
        'cyber-gold': '#FFD166',
        'cyber-glow': '#5FFBF1',
      },
    },
  },
  plugins: [],
};
