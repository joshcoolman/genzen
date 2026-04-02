/**
 * Breakpoint values (in pixels) matching Tailwind v4 config
 * Defined in src/styles.css @theme
 */
export const BREAKPOINTS = {
  xs: 400, // Custom mobile cutoff
  sm: 640, // Tailwind default
  md: 768, // Primary mobile/desktop split
  lg: 1024, // Tailwind default
  xl: 1280, // Tailwind default
  '2xl': 1536, // Tailwind default
} as const

/**
 * Mobile full-screen dialog header height
 * Used in h-[calc(100%-{value}px)] calculations
 */
export const MOBILE_DIALOG_HEADER_HEIGHT = 37 // px (10px top + 16px text + 10px bottom + 1px border)

/**
 * Dashboard header height
 */
export const DASHBOARD_HEADER_HEIGHT = 49 // px
