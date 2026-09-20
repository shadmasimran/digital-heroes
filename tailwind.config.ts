import type { Config } from 'tailwindcss';

// Design tokens. Palette: pond-water greens with one warm marigold for generosity.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        mist: '#EAF1EE',   // page background
        paper: '#FBFCFA',  // raised surfaces
        kelp: '#10312B',   // ink + dark surfaces
        tide: '#2F7F79',   // secondary / links
        marigold: '#F5B83D', // the one warm accent: CTAs and "giving" moments
        blush: '#F6DCD2',  // charity content tint
      },
      fontFamily: {
        display: ['"Young Serif"', 'Georgia', 'serif'],
        sans: ['Figtree', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
