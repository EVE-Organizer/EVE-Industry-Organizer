/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx,scss}'],
  theme: {
    extend: {
      colors: {
        eve: {
          orange: '#f5a623',
          blue: '#4a9eff',
          dark: '#0d1117',
          panel: '#161b22',
          border: '#30363d',
        },
      },
    },
  },
  daisyui: {
    themes: [
      {
        eve: {
          primary: '#f5a623',
          secondary: '#4a9eff',
          accent: '#58a6ff',
          neutral: '#21262d',
          'base-100': '#0d1117',
          'base-200': '#161b22',
          'base-300': '#21262d',
          info: '#4a9eff',
          success: '#3fb950',
          warning: '#f5a623',
          error: '#f85149',
        },
      },
    ],
  },
  plugins: [require('daisyui')],
}
