/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx}',
    './hooks/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg:       '#0d0d0d',
        'bg-light': '#f5f5f0',
        muted:    '#3a3a3a',
        'muted-light': '#c0c0b8',
        active:   '#e2e2e2',
        accent:   'var(--accent)',
        error:    '#ca4754',
        stats:    '#888888',
        orange:   '#f09050',
        filler:   'rgba(139,92,246,0.08)',
      },
      fontFamily: {
        mono: ['var(--font-mono)', 'JetBrains Mono', 'Fira Code', 'Inconsolata', 'monospace'],
      },
      animation: {
        'cursor-pulse': 'cursor-pulse 1s ease-in-out infinite',
        'mic-ring':     'mic-ring 1.5s ease-in-out infinite',
        'dot-pulse':    'dot-pulse 1s ease-in-out infinite',
      },
      keyframes: {
        'cursor-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0' },
        },
        'mic-ring': {
          '0%':   { transform: 'scale(1)',   opacity: '0.8' },
          '100%': { transform: 'scale(1.5)', opacity: '0' },
        },
        'dot-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.2' },
        },
      },
    },
  },
  plugins: [],
}
