// Tailwind v4 through PostCSS. The Vite build used @tailwindcss/vite; Next has
// no Vite pipeline, so the equivalent plugin is the PostCSS one. Theme config
// stays where it has always been -- CSS, in src/styles.css.
export default {
  plugins: { '@tailwindcss/postcss': {} },
}
