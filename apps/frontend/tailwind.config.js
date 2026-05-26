/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["IBM Plex Sans", "Noto Sans", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"]
      }
    }
  },
  plugins: []
}

