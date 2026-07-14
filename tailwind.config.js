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
          'primary-content': '#0d1117',
          secondary: '#4a9eff',
          'secondary-content': '#0d1117',
          accent: '#58a6ff',
          'accent-content': '#0d1117',
          neutral: '#21262d',
          'base-100': '#0d1117',
          'base-200': '#161b22',
          'base-300': '#21262d',
          'base-content': '#e6edf3',
          info: '#4a9eff',
          'info-content': '#0d1117',
          success: '#3fb950',
          'success-content': '#0d1117',
          warning: '#f5a623',
          'warning-content': '#0d1117',
          error: '#f85149',
          'error-content': '#ffffff',
        },
      },
    ],
  },
  plugins: [require('daisyui')],
}
