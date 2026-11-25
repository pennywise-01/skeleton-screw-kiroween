/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './node_modules/skeleton/dist/**/*.js',
  ],
  theme: {
    extend: {
      colors: {
        night: '#0d0217',
        'night-2': '#1a0b2e',
        pumpkin: '#ff7518',
        ectoplasm: '#39ff14',
        witch: '#8b5cf6',
        blood: '#b91c1c',
      },
      fontFamily: {
        spooky: ['Creepster', 'cursive'],
      },
    },
  },
  plugins: [],
}
