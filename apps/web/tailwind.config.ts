import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#1553A2',
          deep: '#103E7A',
          soft: '#EFF5FF',
          border: '#D5E4FA',
        },
        kpi: {
          blue: '#1553A2',
          blueSoft: '#EFF5FF',
          violet: '#7846FF',
          violetSoft: '#F7F4FF',
          amber: '#F59E0B',
          amberSoft: '#FFFBEB',
          emerald: '#0BAF7C',
          emeraldSoft: '#F0FDF7',
        },
        canvas: '#F5F7FC',
        ink: {
          DEFAULT: '#17253F',
          muted: '#64748B',
          subtle: '#94A3B8',
        },
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', '"Be Vietnam Pro"', 'system-ui', 'sans-serif'],
        sans: ['"Be Vietnam Pro"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"Be Vietnam Pro"', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
      },
      boxShadow: {
        card: '0 4px 20px -6px rgba(23, 37, 63, 0.06)',
        elevated: '0 16px 40px -12px rgba(21, 83, 162, 0.12)',
      },
    },
  },
  plugins: [],
};

export default config;

