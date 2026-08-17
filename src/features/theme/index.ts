/* The client-safe half only.
 *
 * `theme-store.server` is deliberately absent: it imports `db.server`, and a
 * barrel re-exporting both halves is exactly how a client component ends up
 * pulling the database into its bundle. Server callers import it by path.
 * `features/auth` states the same rule for the same reason. */

export {
  DEFAULT_CORE,
  THEME_CORE_KEYS,
  contrastRatio,
  deriveTheme,
  isHexColor,
  paletteToCss,
  themeToCss,
  type ThemeCore,
  type ThemePalette,
} from './derive'
