import type { Config } from 'tailwindcss';

/**
 * "Crimson Noir": a five-tone palette built around #9B1313.
 *   bone    #F4ECEC  headings, primary text
 *   blush   #F2B8B5  accents, links, active text (readable on dark)
 *   rose    #C98F8F  secondary accents, chart tints
 *   crimson #9B1313  brand: fills, glows, primary actions (white text on it)
 *   noir    #0E0A0B  surfaces
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        noir: {
          950: '#070405',
          900: '#0E0A0B',
          850: '#141011',
          800: '#1B1517',
          700: '#271E21',
          600: '#3A2D31',
          500: '#5A4A4F',
        },
        crimson: {
          DEFAULT: '#9B1313',
          950: '#2A0404',
          900: '#3F0606',
          800: '#5C0A0A',
          700: '#7A0E0E',
          600: '#9B1313',
          500: '#B92323',
          400: '#D64545',
          300: '#E87878',
        },
        blush: '#F2B8B5',
        rose: '#C98F8F',
        bone: '#F4ECEC',
        fog: '#A89EA1',
        ash: '#6E6366',
        jade: '#5FD3A4',
        amber: '#E9C46A',
        coral: '#FF8A7A',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'ui-serif', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        glass: 'inset 0 1px 0 0 rgba(255,255,255,0.06), 0 20px 50px -20px rgba(0,0,0,0.7)',
        lift: 'inset 0 1px 0 0 rgba(255,255,255,0.08), 0 30px 60px -24px rgba(0,0,0,0.85), 0 0 0 1px rgba(242,184,181,0.08)',
        ember: '0 0 0 1px rgba(214,69,69,0.35), 0 12px 40px -8px rgba(155,19,19,0.65)',
      },
      keyframes: {
        drift: {
          '0%, 100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '33%': { transform: 'translate3d(6%,-4%,0) scale(1.08)' },
          '66%': { transform: 'translate3d(-5%,5%,0) scale(0.95)' },
        },
        spin: { to: { transform: 'rotate(360deg)' } },
        breathe: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.55' },
          '50%': { transform: 'scale(1.18)', opacity: '0' },
        },
        shimmer: { '0%': { transform: 'translateX(-120%)' }, '100%': { transform: 'translateX(120%)' } },
        flow: { to: { strokeDashoffset: '-20' } },
        blink: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.35' } },
      },
      animation: {
        drift: 'drift 26s ease-in-out infinite',
        'drift-slow': 'drift 38s ease-in-out infinite reverse',
        'spin-slow': 'spin 14s linear infinite',
        'spin-fast': 'spin 2.4s linear infinite',
        breathe: 'breathe 2.4s ease-out infinite',
        shimmer: 'shimmer 1.6s ease-in-out infinite',
        blink: 'blink 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
