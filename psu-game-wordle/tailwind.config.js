/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'football-green': '#2e7d32', // Grass green
        'football-brown': '#8d6e63', // Leather brown for accents
        'penn-state-blue': '#041E42', // Penn State blue
      },
      keyframes: {
        flip: {
          '0%': { transform: 'rotateX(0)' },
          '45%': { transform: 'rotateX(90deg)' },
          '55%': { transform: 'rotateX(90deg)' },
          '100%': { transform: 'rotateX(0)' }
        },
        bounceShort: {
          '0%, 20%': { transform: 'translateY(0)' },
          '40%': { transform: 'translateY(-30px)' },
          '50%': { transform: 'translateY(5px)' },
          '60%': { transform: 'translateY(0)' },
          '80%': { transform: 'translateY(-10px)' },
          '100%': { transform: 'translateY(0)' }
        }
      },
      animation: {
        flip: 'flip 0.5s ease forwards',
        bounceShort: 'bounceShort 0.5s ease-in-out'
      }
    },
  },
  plugins: [],
}
