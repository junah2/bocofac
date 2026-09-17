/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Muted sage/botanical palette (matching the Naturelle Botanicals
        // reference board), softer and more desaturated than the earlier
        // Tropical Coco forest-green pass.
        'brand-green': '#6B7C52',
        'coconut-cream': '#EDE6DB',
        'coconut-brown': '#6F4E37',
        'brand-cream': '#FAF8F4',
        'brand-amber': '#D97706',
        'earthy-black': '#2B2B2B',
        'palm-leaf': '#A8B587',
        'brand-darkgreen': '#1E2318',
        // The app uses Tailwind's built-in `emerald-*` scale everywhere
        // (274+ usages across the codebase) for its primary brand color.
        // Overriding the scale here (anchored on the sage board: 400 =
        // soft sage #A8B587, 600 = the reference's button green #6B7C52)
        // reskins every existing emerald-* class app-wide without having
        // to touch each usage individually.
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
        // Brand board's display face - used sparingly on hero/wordmark
        // headings via `font-serif`, everything else stays Poppins.
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
