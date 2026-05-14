/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        warm: {
          50:  '#f5f0e6',
          100: '#ede8de',
          200: '#d4cfc4',
          300: '#a8a193',
          400: '#8a857a',
          500: '#6a655b',
          600: '#4a463e',
          700: '#2f2c25',
          750: '#252220',
          800: '#1f1d1a',
          900: '#16140f',
          950: '#1b1a17',
        },

        brand: {
          50:  '#fbeee8',
          100: '#f4d4c5',
          200: '#f1bba5',
          300: '#eda080',
          400: '#e5916e',
          500: '#d97757',
          600: '#c95f3a',
          700: '#b04826',
          800: '#8a3a1f',
          900: '#3a1812',
        },

        orange: {
          50:  '#fbeee8',
          100: '#f4d4c5',
          400: '#e5916e',
          500: '#d97757',
          600: '#c95f3a',
          700: '#b04826',
        },

        gold: '#f5b855',

        action: {
          fold:       '#6b7280',
          call:       '#22c55e',
          raise:      '#ef4444',
          allin:      '#6b2d0d',
          'allin-led':'#c95f3a',
        },

        result: {
          good:      '#34d399',
          mid:       '#facc15',
          bad:       '#f87171',
          untrained: '#2a3444',
        },

        suit: {
          spade:   '#1f1d1a',
          heart:   '#dc2626',
          diamond: '#2563eb',
          club:    '#047857',
        },
      },

      fontFamily: {
        sans:    ['"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
        display: ['"Bebas Neue"', '"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
        stat:    ['Inter', '"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
        serif:   ['"Instrument Serif"', '"Iowan Old Style"', 'Georgia', 'serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', '"SF Mono"', 'Menlo', 'Consolas', 'monospace'],
      },

      fontSize: {
        '2xs': ['10px', { lineHeight: '1.3' }],
      },

      letterSpacing: {
        widest: '0.22em',
      },

      borderRadius: {
        DEFAULT: '8px',
        chip:    '999px',
      },
    },
  },
  plugins: [],
}
