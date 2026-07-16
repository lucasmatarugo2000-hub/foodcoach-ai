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
        'primary-dark': '#14532d',
        warning: '#eab308',
        danger: '#ef4444',
        // The existing UI uses `text-white`/`text-white/NN` everywhere as its
        // foreground color. Re-pointing the `white` token at a CSS variable lets
        // every existing component pick up light-mode colors automatically,
        // without touching each file. `black` stays literal — it's only used as
        // button text on top of the (always-mid-tone) primary green.
        white: 'rgb(var(--color-foreground) / <alpha-value>)',
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
      },
      animation: {
        breathe: 'breathe 3s ease-in-out infinite',
        'fade-in': 'fadeIn 0.4s ease-out both',
      },
    },
  },
  plugins: [],
}
export default config
