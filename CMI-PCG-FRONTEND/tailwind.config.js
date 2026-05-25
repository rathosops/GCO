/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },

      colors: {
        primary: {
          100: "var(--primary-100)",
          200: "var(--primary-200)",
          300: "var(--primary-300)",
          500: "var(--primary-100)",
          600: "var(--primary-100)",
          700: "var(--primary-200)",
        },

        accent: {
          100: "var(--accent-100)",
          200: "var(--accent-200)",
        },

        text: {
          100: "var(--text-100)",
          200: "var(--text-200)",
        },

        bg: {
          100: "var(--bg-100)",
          200: "var(--bg-200)",
          300: "var(--bg-300)",
        },

        /**
         * "secondary" mapeado para tokens do tema.
         * Agora funciona em dark mode porque os tokens subjacentes
         * são escuros quando o tema é escuro.
         */
        secondary: {
          50:  "var(--bg-200)",
          100: "var(--accent-100)",
          200: "var(--bg-300)",
          300: "var(--accent-200)",
          400: "var(--text-200)",
          500: "var(--text-200)",
          600: "var(--text-100)",
          700: "var(--text-100)",
          800: "var(--text-100)",
          900: "var(--text-100)",
        },

        /**
         * Cores semânticas via CSS vars para funcionar em ambos os temas.
         * Light: fundo claro + texto escuro.
         * Dark: fundo escuro + texto vivo.
         */
        success: {
          DEFAULT: "var(--color-success)",
          light: "var(--color-success-light)",
        },
        danger: {
          DEFAULT: "var(--color-danger)",
          light: "var(--color-danger-light)",
        },
        warning: {
          DEFAULT: "var(--color-warning)",
          light: "var(--color-warning-light)",
        },
      },

      boxShadow: {
        soft: "var(--shadow-md)",
      },
    },
  },
  plugins: [],
}