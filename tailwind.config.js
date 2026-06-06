/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        kum: {
          bg: '#050505',
          card: '#0B0B0B',
          cardHover: '#111111',
          border: '#1A1A1A',
          borderLight: '#2A2A2A',
          text: '#F5F5F5',
          textMuted: '#888888',
          textDim: '#555555',
          primary: '#FF7A00',
          primaryDark: '#CC6200',
          primaryLight: '#FF9933',
          secondary: '#F59E0B',
          accent: '#FFB84D',
          success: '#22C55E',
          successMuted: '#166534',
          danger: '#EF4444',
          dangerMuted: '#991B1B',
          glow: 'rgba(255, 122, 0, 0.15)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'glow': '0 0 20px rgba(255, 122, 0, 0.1)',
        'glow-lg': '0 0 40px rgba(255, 122, 0, 0.15)',
        'card': '0 4px 20px rgba(0, 0, 0, 0.4)',
        'card-lg': '0 8px 40px rgba(0, 0, 0, 0.5)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
