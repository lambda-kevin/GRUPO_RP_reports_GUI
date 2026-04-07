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
    },
  },
  plugins: [],
}
