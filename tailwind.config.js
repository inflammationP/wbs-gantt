/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0d10',
        panel: '#11151b',
        panel2: '#171c23',
        border: '#242c35',
        line: '#1b222a',
        fg: '#e6edf3',
        muted: '#94a1ad',
        dim: '#5b6672',
        accent: '#46b8e6',
        today: '#e3b341',
      },
    },
  },
  plugins: [],
}
