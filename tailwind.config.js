/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4F46E5',
          hover: '#4338CA',
          light: '#EEF2FF',
          border: '#C7D2FE',
        },
        success: {
          DEFAULT: '#10B981',
          light: '#ECFDF5',
          border: '#A7F3D0',
        },
        warning: {
          DEFAULT: '#F59E0B',
          light: '#FFFBEB',
          border: '#FDE68A',
        },
        danger: {
          DEFAULT: '#EF4444',
          light: '#FEF2F2',
          border: '#FECACA',
        },
        sidebar: {
          DEFAULT: '#10213F',
          dark: '#0B172C',
          light: '#1A3258',
          hover: '#162C52',
          active: '#1E3A6E',
          text: '#94A3B8',
          textActive: '#FFFFFF',
          border: '#1E293B',
        },
        surface: {
          bg: '#F7F9FC',
          card: '#FFFFFF',
          border: '#E2E8F0',
          hover: '#F1F5F9',
        },
        content: {
          text: '#172033',
          muted: '#6B7280',
          subtle: '#9CA3AF',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        card: '0 1px 4px 0 rgba(16, 33, 63, 0.06), 0 1px 2px -1px rgba(16, 33, 63, 0.04)',
        drawer: '-4px 0 24px -2px rgba(16, 33, 63, 0.12)',
        modal: '0 20px 25px -5px rgba(16, 33, 63, 0.1), 0 8px 10px -6px rgba(16, 33, 63, 0.08)',
      }
    },
  },
  plugins: [],
}
