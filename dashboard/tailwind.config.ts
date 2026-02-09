import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          darkest: '#061A19',
          dark: '#0D3B3B',
          primary: '#106A6A',
          'primary-dark': '#184E4E',
          accent: '#08DEDE',
          muted: '#9EB6B6',
          text: '#F5F7F6',
          white: '#FFFFFF',
        },
        score: {
          green: '#22C55E',
          yellow: '#EAB308',
          red: '#EF4444',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
export default config
