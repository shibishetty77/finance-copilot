import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Brand accent: single teal ────────────────────────────────────────
        brand: {
          50:  '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',  // Primary teal
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
          950: '#042f2e',
        },
        // ── Surface: CSS-variable driven, adapts to light/dark ───────────────
        surface: {
          DEFAULT: 'var(--surface-bg)',
          card:    'var(--surface-card)',
          input:   'var(--surface-input)',
          border:  'var(--surface-border)',
          hover:   'var(--surface-hover)',
        },
        // ── Semantic ─────────────────────────────────────────────────────────
        income:  '#16a34a',   // green-600  — income / positive
        expense: '#dc2626',   // red-600    — expense / negative
        warning: '#d97706',   // amber-600
        info:    '#2563eb',   // blue-600
      },
      textColor: {
        // Theme-aware text helpers
        primary:   'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        muted:     'var(--text-muted)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1rem' }],
      },
      animation: {
        'fade-in':    'fadeIn 0.25s ease-out',
        'slide-up':   'slideUp 0.35s ease-out',
        'slide-down': 'slideDown 0.35s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer':    'shimmer 1.5s infinite',
        'scale-in':   'scaleIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn:    { '0%': { opacity: '0' },                                       '100%': { opacity: '1' } },
        slideUp:   { '0%': { transform: 'translateY(12px)', opacity: '0' },        '100%': { transform: 'translateY(0)', opacity: '1' } },
        slideDown: { '0%': { transform: 'translateY(-12px)', opacity: '0' },       '100%': { transform: 'translateY(0)', opacity: '1' } },
        scaleIn:   { '0%': { transform: 'scale(0.96)', opacity: '0' },             '100%': { transform: 'scale(1)', opacity: '1' } },
        shimmer:   { '0%': { backgroundPosition: '-200% 0' },                      '100%': { backgroundPosition: '200% 0' } },
      },
      backgroundImage: {
        'gradient-radial':   'radial-gradient(var(--tw-gradient-stops))',
        'shimmer-gradient':  'linear-gradient(90deg, transparent 25%, rgba(128,128,128,0.08) 50%, transparent 75%)',
      },
      boxShadow: {
        'glow':    '0 0 16px rgba(20, 184, 166, 0.22)',
        'glow-lg': '0 0 32px rgba(20, 184, 166, 0.32)',
        'card':    '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.05)',
        'card-lg': '0 4px 24px rgba(0,0,0,0.10)',
      },
    },
  },
  plugins: [],
}

export default config
