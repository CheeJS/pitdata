/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        f1: {
          red: '#E10600',
          dark: '#15151E',
          carbon: '#1F1F27',
          gray: '#38383F',
          light: '#F3F3F3',
        },
        team: {
          ferrari: '#E8002d',
          mclaren: '#FF8000',
          redbull: '#3671C6',
          mercedes: '#27F4D2',
          aston: '#225941',
          alpine: '#0093cc',
          williams: '#64C4FF',
          haas: '#B6BABD',
          sauber: '#52e252',
          rb: '#6692FF'
        }
      },
      fontFamily: {
        heading: ['Outfit', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
