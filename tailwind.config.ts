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
        // Tinted to the accent hue — see the "colors" block below.
        'glow-accent': '0 0 40px rgba(118, 56, 250, 0.45)',
        panel: '0 32px 120px rgba(0, 0, 0, 0.55)',
        // Modal/dialog elevation: a crisp light ring plus a deep drop shadow,
        // so a dialog whose fill color sits close to the page background
        // still visibly separates from it — see components/ui/dialog.tsx.
        modal: '0 0 0 1px rgba(255, 255, 255, 0.16), 0 40px 140px rgba(0, 0, 0, 0.7)',
      },
      colors: {
        // brand-950 is near-black (page background), brand-100 is
        // near-white (highest-emphasis text) — kept neutral so the accent
        // color below is the only hue in the system, same as the reference
        // (eliseai.com: pure black/white everywhere except its one violet
        // CTA color — its own logotype stays plain white, not accent-tinted,
        // which is why ours does too; see the Image usages of
        // logo-mark-white.png).
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
        // Violet — sampled directly from eliseai.com's "Request Demo" CTA
        // (#7638fa, pixel-sampled, not eyeballed). hover/muted are that same
        // hue lightened toward white, following this app's existing
        // "hover brightens" convention on dark surfaces.
        accent: {
          DEFAULT: '#7638fa',
          hover: '#9061fb',
          muted: '#c4a8fd',
          soft: 'rgba(118, 56, 250, 0.16)',
        },
        panel: {
          950: '#050505',
          900: '#101010',
          800: '#1a1a1a',
        },
      },
      backgroundImage: {
        'auth-visual':
          'linear-gradient(180deg, rgba(5, 5, 5, 0.15) 0%, rgba(5, 5, 5, 0.92) 100%), radial-gradient(ellipse 120% 80% at 20% 90%, rgba(118, 56, 250, 0.22) 0%, transparent 55%), radial-gradient(ellipse 80% 60% at 80% 10%, rgba(118, 56, 250, 0.12) 0%, transparent 50%), linear-gradient(145deg, #0a0a0a 0%, #1c1c1c 35%, #050505 100%)',
        'page-glow':
          'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(118, 56, 250, 0.16), transparent 60%)',
      },
    },
  },
  plugins: [],
};

export default config;
