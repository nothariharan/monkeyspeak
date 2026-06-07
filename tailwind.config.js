/**@type {import('tailwindcss').Config} */
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
        bg:       'var(--bg)',
        surface:  'var(--surface)',
        border:   'var(--border)',
        muted:    'var(--text-muted)',
        active:   'var(--text-active)',
        accent:   'var(--accent)',
        success:  'var(--success)',
        error:    'var(--error)',
        stats:    'var(--text-stats)',
        orange:   'var(--orange)',
      },
      fontFamily: {
        mono:    ['var(--font-mono)', 'JetBrains Mono', 'Fira Code', 'Inconsolata', 'monospace'],
        display: ['var(--font-display)', 'Archivo Black', 'Archivo', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft:    'var(--shadow-soft)',
        'soft-sm': 'var(--shadow-soft-sm)',
        accent:  'var(--shadow-accent)',
      },
      animation: {
        'cursor-pulse': 'cursor-pulse 1s ease-in-out infinite',
        'mic-ring':     'mic-ring 1.5s ease-in-out infinite',
        'dot-pulse':    'dot-pulse 1s ease-in-out infinite',
        'live-pulse':   'live-pulse 1.2s ease-in-out infinite',
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
        'live-pulse': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%':      { opacity: '0.5', transform: 'scale(0.85)' },
        },
      },
    },
  },
  plugins: [],
}
