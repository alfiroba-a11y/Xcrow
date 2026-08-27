/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#0A1826',
          900: '#0F2338',
          800: '#12314F',
          700: '#1B3A63',
          600: '#254B7A',
        },
        emerald: {
          600: '#1E7A6D',
          500: '#2FA968',
          400: '#4FC585',
        },
        amber: { 500: '#E8A33D' },
        rose: { 500: '#E0524F' },
        slate: {
          50: '#F4F7FA',
          100: '#E9EEF3',
          400: '#8A9AAE',
          500: '#64748B',
          700: '#374357',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      backgroundImage: {
        'xcrow-gradient': 'linear-gradient(135deg, #1B3A63 0%, #1E7A6D 55%, #2FA968 100%)',
      },
    },
  },
  plugins: [],
};
