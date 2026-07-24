/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eef4f9',
          100: '#d4e3ef',
          200: '#a8c7df',
          300: '#7cabcf',
          400: '#4f8fbf',
          500: '#1a6b96',
          600: '#145374',
          700: '#0c3b54',
          800: '#082a3c',
          900: '#041824',
          950: '#020e16',
        },
        accent: {
          50:  '#fdf8ef',
          100: '#f9ecd4',
          200: '#f0d5a3',
          300: '#e6bc72',
          400: '#d4a843',
          500: '#c8963e',
          600: '#a67b2f',
          700: '#7d5c23',
          800: '#553e18',
          900: '#2e210d',
        },
        navy: {
          50:  '#f0f3f7',
          100: '#d9e0ea',
          200: '#b3c1d5',
          300: '#8da2c0',
          400: '#6783ab',
          500: '#416496',
          600: '#2d4a75',
          700: '#1a365d',
          800: '#112540',
          900: '#0a1728',
          950: '#050c15',
        },
      },
      fontFamily: {
        cairo: ['Cairo', 'sans-serif'],
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      }
    },
  },
  plugins: [],
};
