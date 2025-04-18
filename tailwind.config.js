/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./views/**/*.ejs",
    "./public/**/*.js",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          light: '#818cf8',
          DEFAULT: '#5d6cfa',
          dark: '#4a59e8',
        },
        secondary: {
          light: '#e0d7ff',
          DEFAULT: '#c8b7ff',
          dark: '#9f88ff',
        },
        neutral: {
          lightest: '#f9f9f9',
          lighter: '#f5f5f5',
          light: '#eee',
          DEFAULT: '#ddd',
          dark: '#aaa',
          darker: '#777',
          darkest: '#444',
        },
        issue: {
          repetition: '#ffd9e3',
          grammar: '#c6e9d5',
          pause: '#d3e5ff',
          filler: '#ffddbb',
          mispronunciation: '#e0d7ff',
          stuttering: '#c8e6ff',
        }
      },
      fontFamily: {
        sans: ['Segoe UI', 'Tahoma', 'Geneva', 'Verdana', 'sans-serif'],
      },
      boxShadow: {
        card: '0 2px 5px rgba(0, 0, 0, 0.05)',
        modal: '0 4px 20px rgba(0, 0, 0, 0.15)',
      },
    },
  },
  plugins: [],
}

