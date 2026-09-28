module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'brand-green': '#6B7C52',
        'coconut-cream': '#EDE6DB',
        'coconut-brown': '#6F4E37',
        'brand-cream': '#FAF8F4',
        'brand-amber': '#D97706',
        'earthy-black': '#2B2B2B',
        'palm-leaf': '#A8B587',
        'brand-darkgreen': '#1E2318',
        emerald: {
          50: '#f7f7f2',
          100: '#ebebe0',
          200: '#d8dbc4',
          300: '#c1c9a3',
          400: '#a8b587',
          500: '#8f9d6c',
          600: '#6b7c52',
          700: '#566343',
          800: '#424c34',
          900: '#313826',
          950: '#1e2318',
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
