/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: 'rgb(242 251 245)',
          100: 'rgb(229 247 236)',
          200: 'rgb(197 232 212)',
          300: 'rgb(156 212 181)',
          400: 'rgb(116 191 151)',
          500: 'rgb(86 183 129)',
          600: 'rgb(63 157 108)',
          700: 'rgb(47 125 88)',
          800: 'rgb(35 96 68)',
          900: 'rgb(31 90 65)',
          950: 'rgb(20 58 42)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      // Raise the minimum font scale so text-xs = 14px, text-sm = 15px
      // This cascades to every component without changing individual files
      fontSize: {
        xs:   ['0.875rem', { lineHeight: '1.35rem' }],   // 14px  (was 12px)
        sm:   ['0.9375rem', { lineHeight: '1.5rem' }],   // 15px  (was 14px)
        base: ['1rem',     { lineHeight: '1.6rem' }],    // 16px  (unchanged)
        lg:   ['1.125rem', { lineHeight: '1.75rem' }],   // 18px
        xl:   ['1.25rem',  { lineHeight: '1.85rem' }],   // 20px
        '2xl':['1.5rem',   { lineHeight: '2rem'    }],   // 24px
        '3xl':['1.875rem', { lineHeight: '2.25rem' }],   // 30px
      },
      // Ensure minimum 44px touch targets are easy to compose
      minHeight: { touch: '2.75rem' },
      minWidth:  { touch: '2.75rem' },
    },
  },
  plugins: [],
}
