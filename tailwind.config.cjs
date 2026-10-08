/** @type {import('tailwindcss').Config} */
// 治愈温和的配色系统：奶油白底 + 鼠尾草绿主色 + 淡杏点缀
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#FDFBF8',
          100: '#FAF7F2',
          200: '#F3EDE3',
          300: '#E7DED0'
        },
        sage: {
          100: '#E9F1EC',
          200: '#D2E2D8',
          300: '#B4CDBD',
          400: '#8FAE9B',
          500: '#77997F',
          600: '#5F7F69',
          700: '#4C6855'
        },
        apricot: {
          100: '#FBEFE1',
          200: '#F5DFC7',
          300: '#EFCBA6',
          400: '#E2B183'
        },
        ink: {
          300: '#A9A9A9',
          500: '#7B7B7B',
          700: '#4A4A4A',
          900: '#2F2F2F'
        },
        night: {
          950: '#171B1A',
          900: '#1D2220',
          800: '#252B29',
          700: '#333A37',
          600: '#46504B'
        }
      },
      borderRadius: {
        '4xl': '22px'
      },
      boxShadow: {
        soft: '0 8px 24px -12px rgba(74, 74, 74, 0.22)',
        softer: '0 3px 12px -6px rgba(74, 74, 74, 0.18)'
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        pop: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' }
        }
      },
      animation: {
        'fade-up': 'fade-up 0.28s ease-out both',
        'fade-in': 'fade-in 0.24s ease-out both',
        pop: 'pop 0.2s ease-out both'
      }
    }
  },
  plugins: []
}
