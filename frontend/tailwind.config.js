/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist Sans', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'JetBrains Mono', 'monospace'],
        display: ['Orbitron', 'sans-serif'],
      },
      colors: {
        jarvis: {
          bg: 'var(--bg)',
          'bg-elevated': 'var(--bg-elevated)',
          'bg-panel': 'var(--bg-panel)',
          'bg-glass': 'var(--bg-glass)',
          'bg-glass-strong': 'var(--bg-glass-strong)',
          hairline: 'var(--hairline)',
          'hairline-bright': 'var(--hairline-bright)',
          'text-main': 'var(--text-main)',
          'text-muted': 'var(--text-muted)',
          'text-dim': 'var(--text-dim)',
          accent: 'var(--accent)',
          'accent-bright': 'var(--accent-bright)',
          'accent-glow': 'var(--accent-glow)',
          'accent-dim': 'var(--accent-dim)',
          'user-tint': 'var(--user-tint)',
          'user-border': 'var(--user-border)',
          // Legacy mappings to preserve compatibility with existing shaders and canvas uniforms
          cyan: 'var(--accent)',
          'cyan-bright': 'var(--accent-bright)',
          'cyan-dim': 'var(--accent-dim)',
          blue: 'var(--accent-glow)',
          'blue-deep': 'var(--user-border)',
          slate: 'var(--text-muted)',
          'slate-dim': 'var(--text-dim)',
          border: 'var(--hairline)',
          'border-bright': 'var(--hairline-bright)',
        },
      },
      animation: {
        'orb-pulse': 'orb-pulse 3s ease-in-out infinite',
        'orb-rotate-slow': 'orb-rotate 20s linear infinite',
        'orb-rotate-reverse': 'orb-rotate-reverse 25s linear infinite',
        'ring-pulse': 'ring-pulse 1.5s ease-out infinite',
        'fade-in': 'fade-in 0.4s ease forwards',
        'scan-line': 'scan-line 4s ease-in-out infinite',
        'flicker': 'flicker 4s ease-in-out infinite',
        'border-beam': 'border-beam 4s linear infinite',
      },
      keyframes: {
        'orb-pulse': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.04)', opacity: '0.9' },
        },
        'orb-rotate': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'orb-rotate-reverse': {
          '0%': { transform: 'rotate(360deg)' },
          '100%': { transform: 'rotate(0deg)' },
        },
        'ring-pulse': {
          '0%': { transform: 'scale(1)', opacity: '0.6' },
          '100%': { transform: 'scale(2)', opacity: '0' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scan-line': {
          '0%, 100%': { transform: 'translateY(-100%)', opacity: '0' },
          '50%': { opacity: '1' },
          '100%': { transform: 'translateY(100%)', opacity: '0' },
        },
        'flicker': {
          '0%, 100%': { opacity: '0.3' },
          '50%': { opacity: '0.6' },
        },
        'border-beam': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
    },
  },
  plugins: [],
};
