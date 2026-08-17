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
        glow: '0 0 0 1px rgba(255, 255, 255, 0.10), 0 20px 60px rgba(0, 0, 0, 0.45)',
        'glow-accent': '0 0 40px rgba(255, 255, 255, 0.20)',
        panel: '0 32px 120px rgba(0, 0, 0, 0.55)',
      },
      colors: {
        // Monochrome design system: same 12-step lightness curve as before,
        // hue removed. brand-950 is near-black (page background), brand-100
        // is near-white (highest-emphasis text).
        brand: {
          950: '#050505',
          900: '#0a0a0a',
          850: '#101010',
          800: '#1a1a1a',
          750: '#232323',
          700: '#2e2e2e',
          600: '#3d3d3d',
          500: '#595959',
          400: '#8a8a8a',
          300: '#a3a3a3',
          200: '#c7c7c7',
          100: '#ededed',
        },
        accent: {
          DEFAULT: '#e8e8e8',
          hover: '#ffffff',
          muted: '#a3a3a3',
          soft: 'rgba(255, 255, 255, 0.12)',
        },
        panel: {
          950: '#050505',
          900: '#101010',
          800: '#1a1a1a',
        },
      },
      backgroundImage: {
        'auth-visual':
          'linear-gradient(180deg, rgba(5, 5, 5, 0.15) 0%, rgba(5, 5, 5, 0.92) 100%), radial-gradient(ellipse 120% 80% at 20% 90%, rgba(255, 255, 255, 0.14) 0%, transparent 55%), radial-gradient(ellipse 80% 60% at 80% 10%, rgba(255, 255, 255, 0.08) 0%, transparent 50%), linear-gradient(145deg, #0a0a0a 0%, #1c1c1c 35%, #050505 100%)',
        'page-glow':
          'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(255, 255, 255, 0.10), transparent 60%)',
      },
    },
  },
  plugins: [],
};

export default config;
