module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'brand-green': '#2F6F4B',
        'coconut-cream': '#EDE6DB',
        'coconut-brown': '#6F4E37',
        'brand-cream': '#FAF8F4',
        'brand-amber': '#D97706',
        'earthy-black': '#2B2B2B',
        'palm-leaf': '#64A67C',
        'brand-darkgreen': '#0F2218',
        emerald: {
          50: '#f2f8f4',
          100: '#e0efe5',
          200: '#c2dfcb',
          300: '#96c6a6',
          400: '#64a67c',
          500: '#43895e',
          600: '#2f6f4b',
          700: '#275a3e',
          800: '#214833',
          900: '#1c3b2b',
          950: '#0f2218',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
