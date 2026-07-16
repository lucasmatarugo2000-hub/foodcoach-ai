import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--color-background) / <alpha-value>)',
        card: 'rgb(var(--color-card) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        secondary: 'rgb(var(--color-secondary) / <alpha-value>)',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        'primary-dark': '#00695c',
        warning: '#eab308',
        danger: '#ef4444',
        // The existing UI uses `text-white`/`text-white/NN` everywhere as its
        // foreground color, and `text-white/50`-style opacity variants as its
        // secondary/muted text color. Re-pointing these tokens at CSS variables
        // lets every existing component pick up the new palette (and light mode)
        // automatically, without touching each file. `black` stays literal — it's
        // only used as button text on top of the (always-mid-tone) primary color.
        white: 'rgb(var(--color-foreground) / <alpha-value>)',
        muted: 'rgb(var(--color-foreground-secondary) / <alpha-value>)',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.04)' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        spin: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        breathe: 'breathe 3s ease-in-out infinite',
        'fade-in': 'fadeIn 0.4s ease-out both',
        'fade-in-up': 'fadeInUp 0.5s ease-out both',
        'spin-slow': 'spin 3s linear infinite',
      },
    },
  },
  plugins: [],
}
export default config
