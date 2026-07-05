import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './store/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'var(--font-jakarta)',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
      },
      borderRadius: {
        gf: '0.75rem',
        'gf-lg': '1rem',
        'gf-xl': '1.25rem',
        'gf-2xl': '1.5rem',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(147, 51, 234, 0.12), 0 20px 60px rgba(0, 0, 0, 0.45)',
        'glow-accent': '0 0 40px rgba(147, 51, 234, 0.25)',
        panel: '0 32px 120px rgba(0, 0, 0, 0.55)',
      },
      colors: {
        brand: {
          950: '#07040f',
          900: '#0c0617',
          850: '#12091c',
          800: '#1a1025',
          750: '#221533',
          700: '#2d1f45',
          600: '#3d2a5c',
          500: '#5b3d8a',
          400: '#8b5cf6',
          300: '#a78bfa',
          200: '#c4b5fd',
          100: '#ede9fe',
        },
        accent: {
          DEFAULT: '#9333ea',
          hover: '#a855f7',
          muted: '#7c3aed',
          soft: 'rgba(147, 51, 234, 0.12)',
        },
        panel: {
          950: '#07040f',
          900: '#12091c',
          800: '#1a1025',
        },
      },
      backgroundImage: {
        'auth-visual':
          'linear-gradient(180deg, rgba(12, 6, 23, 0.15) 0%, rgba(12, 6, 23, 0.92) 100%), radial-gradient(ellipse 120% 80% at 20% 90%, rgba(147, 51, 234, 0.45) 0%, transparent 55%), radial-gradient(ellipse 80% 60% at 80% 10%, rgba(88, 28, 135, 0.35) 0%, transparent 50%), linear-gradient(145deg, #1a0a2e 0%, #2d1b4e 35%, #12091c 100%)',
        'page-glow':
          'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(147, 51, 234, 0.18), transparent 60%)',
      },
    },
  },
  plugins: [],
};

export default config;
